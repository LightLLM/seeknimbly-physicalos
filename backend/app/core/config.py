from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def _load_dotenv(path: Path) -> None:
    """Load KEY=VALUE pairs from a local .env without overriding existing process env."""
    if not path.is_file():
        return
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if not key or key in os.environ:
                continue
            os.environ[key] = value.strip().strip('"').strip("'")
    except OSError:
        return


_load_dotenv(ROOT / ".env")
DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
DATASET_PATH = DATA_RAW / "ai4i2020.csv"
AI4I_CSV = DATASET_PATH
HTML_PATH = ROOT / "api" / "index.html"

DEFAULT_NEBIUS_BASE = "https://api.tokenfactory.us-central1.nebius.com/v1"
DEFAULT_NEBIUS_MODEL = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
NEBIUS_DEFAULT_BASE = DEFAULT_NEBIUS_BASE
NEBIUS_DEFAULT_MODEL = DEFAULT_NEBIUS_MODEL

# Frozen clock for certification checks so demo eligibility does not drift.
DEMO_NOW = datetime(2026, 10, 30, tzinfo=timezone.utc)
TIE_BREAK = "worker id ascending, machine id ascending, robot id ascending"
RULES_FALLBACK = (
    "Deterministic rules fallback: the safety engine selected this assignment without Nebius inference. "
    "This sentence is not an AI-generated explanation and it is not an authorization to execute."
)


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(moment: datetime | None = None) -> str:
    return (moment or utcnow()).isoformat()


def db_path() -> Path:
    override = os.getenv("PHYSICALOS_DB")
    if override:
        return Path(override)
    if os.getenv("VERCEL"):
        return Path("/tmp/physicalos.db")
    return ROOT / "physicalos.db"


def database_url() -> str:
    return "sqlite:///" + db_path().resolve().as_posix()


def proposal_ttl() -> timedelta:
    raw = os.getenv("PHYSICALOS_PROPOSAL_TTL_SECONDS", os.getenv("PROPOSAL_TTL_SECONDS", "7200"))
    return timedelta(seconds=int(raw))


def demo_mode() -> bool:
    return env_bool("DEMO_MODE", True)


def admin_token() -> str:
    return os.getenv("DEMO_ADMIN_TOKEN", "").strip()


def require_ai() -> bool:
    return env_bool("PHYSICALOS_REQUIRE_AI", False)


def ai_configured() -> bool:
    return bool(os.getenv("NEBIUS_API_KEY", "").strip() and os.getenv("NEBIUS_MODEL", "").strip())


def nebius_model() -> str | None:
    model = os.getenv("NEBIUS_MODEL", "").strip()
    return model or None


def nebius_base_url() -> str:
    return os.getenv("NEBIUS_BASE_URL", DEFAULT_NEBIUS_BASE).rstrip("/")


def max_output_tokens() -> int:
    # Nemotron Nano spends part of the budget on hidden reasoning tokens; 100 often
    # exhausts before any assistant content is emitted. Default high enough for one sentence.
    try:
        value = int(os.getenv("NEBIUS_MAX_OUTPUT_TOKENS", "256"))
    except ValueError:
        return 256
    return max(1, min(value, 512))


def app_env() -> str:
    return os.getenv("APP_ENV", "development")


class Settings:
    """Attribute access reads the environment on each use so tests can monkeypatch."""

    @property
    def app_env(self) -> str:
        return app_env()

    @property
    def demo_mode(self) -> bool:
        return demo_mode()

    @property
    def demo_admin_token(self) -> str:
        return admin_token()

    @property
    def require_ai(self) -> bool:
        return require_ai()

    @property
    def nebius_api_key(self) -> str:
        return os.getenv("NEBIUS_API_KEY", "").strip()

    @property
    def nebius_model(self) -> str:
        return os.getenv("NEBIUS_MODEL", "").strip()

    @property
    def nebius_base_url(self) -> str:
        return nebius_base_url()

    @property
    def nebius_max_output_tokens(self) -> int:
        return max_output_tokens()

    @property
    def frontend_url(self) -> str:
        return os.getenv("FRONTEND_URL", "http://localhost:3000")

    @property
    def app_base_url(self) -> str:
        return os.getenv("APP_BASE_URL", "http://localhost:8000")

    @property
    def proposal_ttl_seconds(self) -> int:
        return int(proposal_ttl().total_seconds())

    @property
    def ai_configured(self) -> bool:
        return ai_configured()

    def reload(self) -> None:
        return None


settings = Settings()
