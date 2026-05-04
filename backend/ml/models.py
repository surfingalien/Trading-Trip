"""
Model zoo for FinSight ML Prediction Pipeline.

Two base models:
  1. XGBoostForecaster   — tabular gradient boosting for point forecast + direction
  2. LSTMForecaster      — sequence model for price-path modeling

Ensemble:
  WeightedEnsemble       — blends both based on walk-forward validation performance

All models expose a consistent sklearn-like interface:
  .fit(X, y) / .predict(X) / .predict_proba(X)
"""
from __future__ import annotations
import logging
import os
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, RegressorMixin

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# XGBoost forecaster
# ---------------------------------------------------------------------------

class XGBoostForecaster(BaseEstimator, RegressorMixin):
    """
    Two XGBoost models: one regression (return), one classifier (direction).
    """

    def __init__(
        self,
        n_estimators: int = 500,
        max_depth: int = 5,
        learning_rate: float = 0.03,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        reg_alpha: float = 0.1,
        reg_lambda: float = 1.0,
        random_state: int = 42,
    ):
        self.n_estimators    = n_estimators
        self.max_depth       = max_depth
        self.learning_rate   = learning_rate
        self.subsample       = subsample
        self.colsample_bytree = colsample_bytree
        self.reg_alpha       = reg_alpha
        self.reg_lambda      = reg_lambda
        self.random_state    = random_state
        self._reg    = None
        self._clf    = None

    def fit(self, X: np.ndarray, y_ret: np.ndarray, y_dir: np.ndarray):
        try:
            import xgboost as xgb
        except ImportError:
            raise RuntimeError("xgboost not installed")

        shared_params = dict(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            subsample=self.subsample,
            colsample_bytree=self.colsample_bytree,
            reg_alpha=self.reg_alpha,
            reg_lambda=self.reg_lambda,
            random_state=self.random_state,
            tree_method="hist",
            n_jobs=-1,
        )
        self._reg = xgb.XGBRegressor(**shared_params, objective="reg:squarederror")
        self._clf = xgb.XGBClassifier(**shared_params, objective="binary:logistic", use_label_encoder=False)

        self._reg.fit(X, y_ret, verbose=False)
        self._clf.fit(X, y_dir, verbose=False)
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self._reg.predict(X)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self._clf.predict_proba(X)[:, 1]

    def predict_with_uncertainty(self, X: np.ndarray, n_quantiles: int = 100) -> dict:
        """
        Bootstrap uncertainty via predict on perturbed feature copies.
        Returns dict with point, lower (p10), upper (p90).
        """
        point = self.predict(X)
        boot  = np.array([
            self._reg.predict(X + np.random.normal(0, 0.01, X.shape))
            for _ in range(n_quantiles)
        ])
        return {
            "point": float(point[0]),
            "lower": float(np.percentile(boot[:, 0], 10)),
            "upper": float(np.percentile(boot[:, 0], 90)),
            "prob_positive": float(self.predict_proba(X)[0]),
        }

    @property
    def feature_importances_(self):
        return self._reg.feature_importances_ if self._reg else None


# ---------------------------------------------------------------------------
# LSTM forecaster (PyTorch)
# ---------------------------------------------------------------------------

class LSTMForecaster:
    """
    Stacked LSTM for sequence prediction.
    Accepts a sequence of T timesteps of F features and predicts
    the forward return at horizon H.
    """

    def __init__(
        self,
        input_size: int = 28,
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.3,
        seq_len: int = 30,
        lr: float = 1e-3,
        epochs: int = 50,
        batch_size: int = 64,
        device: str = "cpu",
    ):
        self.input_size  = input_size
        self.hidden_size = hidden_size
        self.num_layers  = num_layers
        self.dropout     = dropout
        self.seq_len     = seq_len
        self.lr          = lr
        self.epochs      = epochs
        self.batch_size  = batch_size
        self.device      = device
        self._model: Optional[object] = None
        self._scaler_x   = None
        self._scaler_y   = None

    def _build_model(self):
        try:
            import torch
            import torch.nn as nn
        except ImportError:
            raise RuntimeError("PyTorch not installed")

        class _Net(nn.Module):
            def __init__(self, inp, hid, layers, drop):
                super().__init__()
                self.lstm = nn.LSTM(inp, hid, layers, batch_first=True,
                                    dropout=drop if layers > 1 else 0)
                self.dropout = nn.Dropout(drop)
                self.fc_ret  = nn.Linear(hid, 1)
                self.fc_dir  = nn.Linear(hid, 1)

            def forward(self, x):
                out, _ = self.lstm(x)
                h = self.dropout(out[:, -1, :])
                return self.fc_ret(h).squeeze(-1), torch.sigmoid(self.fc_dir(h)).squeeze(-1)

        return _Net(self.input_size, self.hidden_size, self.num_layers, self.dropout)

    def _make_sequences(self, X: np.ndarray, y: Optional[np.ndarray] = None):
        seqs, targets = [], []
        for i in range(self.seq_len, len(X) + 1):
            seqs.append(X[i - self.seq_len:i])
            if y is not None:
                targets.append(y[i - 1])
        return np.array(seqs), (np.array(targets) if y is not None else None)

    def fit(self, X: np.ndarray, y_ret: np.ndarray, y_dir: np.ndarray):
        try:
            import torch
            import torch.nn as nn
            from sklearn.preprocessing import StandardScaler
        except ImportError:
            raise RuntimeError("PyTorch / sklearn not installed")

        self._scaler_x = StandardScaler()
        self._scaler_y = StandardScaler()
        X_s = self._scaler_x.fit_transform(X)
        y_s = self._scaler_y.fit_transform(y_ret.reshape(-1, 1)).ravel()

        X_seq, y_seq_ret = self._make_sequences(X_s, y_s)
        _, y_seq_dir     = self._make_sequences(X_s, y_dir)

        if len(X_seq) < 10:
            log.warning("Too few sequences (%d) for LSTM training, skipping", len(X_seq))
            return self

        model = self._build_model().to(self.device)
        optim = torch.optim.Adam(model.parameters(), lr=self.lr)
        loss_ret_fn = nn.MSELoss()
        loss_dir_fn = nn.BCELoss()

        X_t = torch.tensor(X_seq, dtype=torch.float32, device=self.device)
        y_t_ret = torch.tensor(y_seq_ret, dtype=torch.float32, device=self.device)
        y_t_dir = torch.tensor(y_seq_dir, dtype=torch.float32, device=self.device)

        dataset = torch.utils.data.TensorDataset(X_t, y_t_ret, y_t_dir)
        loader  = torch.utils.data.DataLoader(dataset, batch_size=self.batch_size, shuffle=True)

        model.train()
        for epoch in range(self.epochs):
            epoch_loss = 0.0
            for xb, yb_ret, yb_dir in loader:
                optim.zero_grad()
                pred_ret, pred_dir = model(xb)
                loss = loss_ret_fn(pred_ret, yb_ret) + 0.5 * loss_dir_fn(pred_dir, yb_dir)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optim.step()
                epoch_loss += loss.item()
            if (epoch + 1) % 10 == 0:
                log.debug("LSTM epoch %d/%d | loss=%.5f", epoch + 1, self.epochs, epoch_loss)

        model.eval()
        self._model = model
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self._model is None:
            return np.zeros(1)
        import torch
        X_s = self._scaler_x.transform(X)
        if len(X_s) < self.seq_len:
            # Pad with zeros
            pad = np.zeros((self.seq_len - len(X_s), X_s.shape[1]))
            X_s = np.vstack([pad, X_s])
        X_seq = X_s[-self.seq_len:][np.newaxis, :, :]  # (1, seq_len, F)
        X_t = torch.tensor(X_seq, dtype=torch.float32, device=self.device)
        with torch.no_grad():
            pred_ret_s, _ = self._model(X_t)
        pred_ret = self._scaler_y.inverse_transform(pred_ret_s.cpu().numpy().reshape(-1, 1)).ravel()
        return pred_ret

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if self._model is None:
            return np.array([0.5])
        import torch
        X_s = self._scaler_x.transform(X)
        if len(X_s) < self.seq_len:
            pad = np.zeros((self.seq_len - len(X_s), X_s.shape[1]))
            X_s = np.vstack([pad, X_s])
        X_seq = X_s[-self.seq_len:][np.newaxis, :, :]
        X_t = torch.tensor(X_seq, dtype=torch.float32, device=self.device)
        with torch.no_grad():
            _, pred_dir = self._model(X_t)
        return pred_dir.cpu().numpy()


# ---------------------------------------------------------------------------
# Weighted ensemble
# ---------------------------------------------------------------------------

class WeightedEnsemble:
    """
    Combines XGBoost + LSTM with weights derived from walk-forward
    directional accuracy. Higher directional accuracy → higher weight.
    """

    def __init__(
        self,
        xgb_model: XGBoostForecaster,
        lstm_model: LSTMForecaster,
        xgb_weight: float = 0.6,
        lstm_weight: float = 0.4,
    ):
        self.xgb = xgb_model
        self.lstm = lstm_model
        self.xgb_weight  = xgb_weight
        self.lstm_weight = lstm_weight

    def fit(self, X: np.ndarray, y_ret: np.ndarray, y_dir: np.ndarray):
        self.xgb.fit(X, y_ret, y_dir)
        self.lstm.fit(X, y_ret, y_dir)
        return self

    def predict(self, X: np.ndarray) -> float:
        xgb_pred  = float(self.xgb.predict(X[-1:]))
        lstm_pred = float(self.lstm.predict(X))
        return self.xgb_weight * xgb_pred + self.lstm_weight * lstm_pred

    def predict_proba(self, X: np.ndarray) -> float:
        xgb_prob  = float(self.xgb.predict_proba(X[-1:]))
        lstm_prob = float(self.lstm.predict_proba(X))
        return self.xgb_weight * xgb_prob + self.lstm_weight * lstm_prob

    def predict_with_uncertainty(self, X: np.ndarray) -> dict:
        xgb_u = self.xgb.predict_with_uncertainty(X[-1:])
        lstm_p = float(self.lstm.predict(X))
        # Ensemble point
        point    = self.xgb_weight * xgb_u["point"] + self.lstm_weight * lstm_p
        lower    = xgb_u["lower"]
        upper    = xgb_u["upper"]
        prob_pos = self.xgb_weight * xgb_u["prob_positive"] + self.lstm_weight * float(self.lstm.predict_proba(X))
        return {"point": point, "lower": lower, "upper": upper, "prob_positive": prob_pos}

    def update_weights_from_validation(self, xgb_dir_acc: float, lstm_dir_acc: float):
        total = xgb_dir_acc + lstm_dir_acc
        if total > 0:
            self.xgb_weight  = round(xgb_dir_acc / total, 3)
            self.lstm_weight = round(lstm_dir_acc / total, 3)
        log.info("Ensemble weights → XGB=%.3f LSTM=%.3f", self.xgb_weight, self.lstm_weight)


# ---------------------------------------------------------------------------
# Model persistence
# ---------------------------------------------------------------------------

def save_model(model, path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(model, f)
    log.info("Model saved: %s", path)


def load_model(path: str):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model not found: {path}")
    with open(path, "rb") as f:
        model = pickle.load(f)
    log.info("Model loaded: %s", path)
    return model
