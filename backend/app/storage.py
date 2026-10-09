import boto3
from botocore.client import Config

from .config import settings


def _client(endpoint: str):
    return boto3.client("s3", endpoint_url=endpoint, aws_access_key_id=settings.s3_access_key,
                        aws_secret_access_key=settings.s3_secret_key,
                        config=Config(signature_version="s3v4"), region_name="us-east-1")


def ensure_bucket() -> None:
    s3 = _client(settings.s3_endpoint)
    names = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]
    if settings.s3_bucket not in names:
        s3.create_bucket(Bucket=settings.s3_bucket)


def put_object(key: str, data: bytes, content_type: str) -> None:
    _client(settings.s3_endpoint).put_object(Bucket=settings.s3_bucket, Key=key, Body=data,
                                             ContentType=content_type)


def get_object(key: str):
    return _client(settings.s3_endpoint).get_object(Bucket=settings.s3_bucket, Key=key)
