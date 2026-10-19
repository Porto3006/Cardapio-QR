"""Vercel serverless function entry point.

Exports the FastAPI ASGI app from backend.server so Vercel's Python
runtime can serve all /api/* routes from a single serverless function.
"""
import sys
import os

# Add the project root to sys.path so `backend.server` is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.server import app  # noqa: F401  — Vercel detects ASGI `app`
