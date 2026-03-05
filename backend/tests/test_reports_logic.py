from app.utils.ipam import parse_vlan_range


def test_parse_vlan_range():
    assert parse_vlan_range("10-12,20,30") == [10, 11, 12, 20, 30]

