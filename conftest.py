import sys
import os

# Ensure the repo root is on sys.path so `backend.*` imports work in CI
_root = os.path.dirname(__file__)
if _root not in sys.path:
    sys.path.insert(0, _root)
