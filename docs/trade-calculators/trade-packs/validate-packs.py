import json, re, sys, os

ALLOWED_FNS = {"min","max","round","ceil","floor","clamp","sum","map","count","if","coalesce"}
ENGINE_CTX = {"job_type","price_per_m2","modifier_cap_hit","achieved_margin","estimated_days",
              "has_staged_payments","total_price_pence","effective_hourly_pence","total_hours",
              "isolation_valves_count"}

OPERATORS = {"contains"}   # infix operator used by packs; see spec note

def idents(expr):
    if not isinstance(expr,str): return set(),set()
    # string literals are values, not identifiers
    stripped = re.sub(r"'[^']*'", " ", expr)
    toks = set(re.findall(r"[A-Za-z_][A-Za-z0-9_.]*", stripped)) - OPERATORS
    fns  = set(re.findall(r"([A-Za-z_][A-Za-z0-9_]*)\s*\(", stripped))
    return toks, fns

def check(path):
    d = json.load(open(path))
    name = os.path.basename(path)
    errs, warns, notes = [], [], []

    qids = {q["id"] for q in d.get("questions",[])}
    # repeater sub-fields are addressed as r.x / f.x / p.x inside sum()
    dids = {x["id"] for x in d.get("derivations",[])}
    known = qids | dids | ENGINE_CTX | {"settings","r","f","p","true","false"}

    # 1. derivation DAG order + cycles
    seen = set()
    for x in d.get("derivations",[]):
        toks,fns = idents(x["expr"])
        for t in toks:
            base = t.split(".")[0]
            if base in dids and base not in seen and base != x["id"]:
                warns.append(f"derivation '{x['id']}' references '{base}' declared later (engine must topo-sort)")
        if x["id"] in idents(x["expr"])[0]:
            errs.append(f"derivation '{x['id']}' is self-referential (cycle)")
        seen.add(x["id"])

    # 2. all expressions: unknown functions + unresolved identifiers
    def scan(expr, where):
        toks,fns = idents(expr)
        for fn in fns:
            if fn not in ALLOWED_FNS:
                errs.append(f"{where}: function '{fn}()' is outside the whitelisted DSL")
        for t in toks:
            base = t.split(".")[0]
            if base in ALLOWED_FNS or base in known: continue
            if re.fullmatch(r"\d+(\.\d+)?", base): continue
            errs.append(f"{where}: unresolved reference '{t}'")

    for x in d.get("derivations",[]): scan(x["expr"], f"derivation {x['id']}")
    for t in d.get("tasks",[]):
        if "appliesWhen" in t: scan(t["appliesWhen"], f"task {t['id']}.appliesWhen")
        q = t.get("quantity","")
        if not re.fullmatch(r"\d+(\.\d+)?", str(q)): scan(q, f"task {t['id']}.quantity")
        if "source" not in t: errs.append(f"task {t['id']} has no rate source (spec requires one)")
    for m in d.get("materials",[]):
        if "appliesWhen" in m: scan(m["appliesWhen"], f"material {m['id']}.appliesWhen")
        if "quantity" in m and not re.fullmatch(r"\d+(\.\d+)?", str(m["quantity"])):
            scan(m["quantity"], f"material {m['id']}.quantity")
        if "consumption" in m: scan(m["consumption"]["expr"], f"material {m['id']}.consumption")
    for m in d.get("modifiers",[]):
        scan(m["when"], f"modifier {m['id']}.when")
        if isinstance(m.get("factor"),str): scan(m["factor"], f"modifier {m['id']}.factor")
        if "explain" not in m: errs.append(f"modifier {m['id']} has no user-facing explain")
    for e in d.get("extras",[]):
        if "when" in e: scan(e["when"], f"extra {e['id']}.when")
    for r in d.get("risk",{}).get("unknownConditions",[]): scan(r["when"], "risk.unknownConditions")
    for v in d.get("validation",[]): scan(v["when"], f"validation[{v['level']}]")

    # 3. presentation groups cover every task/material/extra group
    groups = set(d.get("presentation",{}).get("groups",[]))
    for coll in ("tasks","materials","extras"):
        for x in d.get(coll,[]):
            g = x.get("group")
            if g and g not in groups:
                errs.append(f"{coll} {x['id']}: group '{g}' not in presentation.groups")

    print(f"=== {name} (specVersion {d.get('specVersion')}) ===")
    for e in errs:  print(f"  ERROR  {e}")
    for w in warns: print(f"  WARN   {w}")
    if not errs and not warns: print("  clean")
    print(f"  -> {len(errs)} errors, {len(warns)} warnings")
    return len(errs)

total = 0
for p in sys.argv[1:]: total += check(p)
sys.exit(1 if total else 0)
