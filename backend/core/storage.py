import os
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def upload_bytes_and_get_url(bucket: str, path: str, data: bytes, content_type: str) -> str:
    """Uploads raw bytes to Supabase Storage and returns its public URL."""
    supabase.storage.from_(bucket).upload(
        path=path, file=data, file_options={"content-type": content_type}
    )
    public_url_response = supabase.storage.from_(bucket).get_public_url(path)

    if isinstance(public_url_response, dict):
        return public_url_response.get("publicUrl", "")
    elif hasattr(public_url_response, "public_url"):
        return public_url_response.public_url
    return str(public_url_response)


def delete_object(bucket: str, path: str) -> None:
    """Best-effort delete — callers are expected to wrap this in their own try/except."""
    supabase.storage.from_(bucket).remove([path])


def path_from_public_url(bucket: str, url: str) -> str:
    """Recovers the storage path (relative to `bucket`) from a Supabase public URL."""
    return url.split(f"storage/v1/object/public/{bucket}/")[-1]
