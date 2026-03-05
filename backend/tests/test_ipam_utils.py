import pytest

from app.utils.ipam import ip_in_prefix, next_free_ip, parse_cidr, parse_ip


def test_parse_cidr_v4_v6():
    assert str(parse_cidr("10.0.0.0/24")) == "10.0.0.0/24"
    assert str(parse_cidr("2001:db8::/64")) == "2001:db8::/64"


def test_next_free_ip():
    used = ["10.0.0.1", "10.0.0.2", "10.0.0.3"]
    assert next_free_ip("10.0.0.0/29", used) == "10.0.0.4"


def test_duplicate_detection_semantic():
    ip1 = parse_ip("10.0.0.10")
    ip2 = parse_ip("10.0.0.10/24")
    assert ip1 == ip2


def test_ip_in_prefix():
    assert ip_in_prefix("10.10.0.5", "10.10.0.0/24") is True
    assert ip_in_prefix("10.10.1.5", "10.10.0.0/24") is False

