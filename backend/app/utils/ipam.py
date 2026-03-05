import ipaddress


def parse_cidr(cidr: str) -> ipaddress._BaseNetwork:
    return ipaddress.ip_network(cidr, strict=False)


def parse_ip(address: str) -> ipaddress._BaseAddress:
    if "/" in address:
        address = address.split("/")[0]
    return ipaddress.ip_address(address)


def ip_in_prefix(address: str, cidr: str) -> bool:
    return parse_ip(address) in parse_cidr(cidr)


def next_free_ip(prefix: str, used_ips: list[str]) -> str | None:
    network = parse_cidr(prefix)
    used = {parse_ip(item) for item in used_ips}
    for candidate in network.hosts():
        if candidate not in used:
            return str(candidate)
    return None


def split_prefix(cidr: str, new_prefix_length: int) -> list[str]:
    network = parse_cidr(cidr)
    return [str(item) for item in network.subnets(new_prefix=new_prefix_length)]


def parse_vlan_range(value: str) -> list[int]:
    result: set[int] = set()
    if not value:
        return []
    for token in value.split(","):
        token = token.strip()
        if "-" in token:
            start, end = token.split("-", 1)
            result.update(range(int(start), int(end) + 1))
        else:
            result.add(int(token))
    return sorted(result)

