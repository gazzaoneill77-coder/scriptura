import json, re, sys, os

ALLOWED_FNS = {"min","max","round","ceil","floor","clamp","sum","map","count","if","coalesce"}
ENGINE_CTX = {"job_type","price_per_m2","modifier_cap_hit","achieved_margin","estimated_days",
              "has_staged_payments","total_price_pence","effective_hourly_pence","total_hours",
              "isolation_valves_count","elapsed_days","programme_days"}

# Values only known AFTER the programme is derived from phase-A hours. Anything priced
# against them must declare stage:"post_programme" or the pack has a circular dependency:
# the item's hours feed the total that defines its own quantity. See spec v5 -> v6.
PROGRAMME_CTX = {"total_hours","elapsed_days","programme_days"}

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
    known = qids | dids | ENGINE_CTX | {"settings","true","false"}

    # 1. derivation DAG order + cycles
    seen = set()
    for x in d.get("derivations",[]):
        toks,fns = idents(x["expr"])
        for t in toks:
            base = t.split(".")[0]
            if len(base) == 1: continue          # scoped loop alias
            if base in dids and base not in seen and base != x["id"]:
                warns.append(f"derivation '{x['id']}' references '{base}' declared later (engine must topo-sort)")
        if x["id"] in idents(x["expr"])[0]:
            errs.append(f"derivation '{x['id']}' is self-referential (cycle)")
        seen.add(x["id"])

    # 2. all expressions: unknown functions + unresolved identifiers
    def bound_aliases(expr):
        """sum(collection, <expr over item>) binds a scoped single-letter item alias.
        The alias is implicit in the spec; accept any single letter used as `x.field`
        inside an expression that iterates. See spec v3 -> v4 finding on scoped aliases."""
        if not isinstance(expr,str) or not re.search(r"\b(sum|map|count)\s*\(", expr):
            return set()
        stripped = re.sub(r"'[^']*'", " ", expr)
        return set(re.findall(r"\b([a-z])\.", stripped))

    def scan(expr, where):
        toks,fns = idents(expr)
        aliases = bound_aliases(expr)
        for fn in fns:
            if fn not in ALLOWED_FNS:
                errs.append(f"{where}: function '{fn}()' is outside the whitelisted DSL")
        for t in toks:
            base = t.split(".")[0]
            if base in ALLOWED_FNS or base in known or base in aliases: continue
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

    # 3. programme cycle: anything priced against the programme must declare its stage
    prog_ids = set(PROGRAMME_CTX)
    changed = True
    while changed:                      # derivations that transitively depend on programme
        changed = False
        for x in d.get("derivations",[]):
            if x["id"] in prog_ids: continue
            toks,_ = idents(x["expr"])
            if {t.split(".")[0] for t in toks} & prog_ids:
                prog_ids.add(x["id"]); changed = True

    def depends_on_programme(expr):
        if not isinstance(expr,str): return False
        toks,_ = idents(expr)
        return bool({t.split(".")[0] for t in toks} & prog_ids)

    for coll in ("tasks","extras","materials"):
        for x in d.get(coll,[]):
            pricing = x.get("pricing",{}) or {}
            hit = (depends_on_programme(str(x.get("quantity","")))
                   or depends_on_programme(str(pricing.get("days","")))
                   or "perDayPence" in pricing)
            if hit and x.get("stage") != "post_programme":
                errs.append(f"{coll} {x['id']}: priced against the programme but no "
                            f"stage:\"post_programme\" — circular dependency")

    # 4. presentation groups cover every task/material/extra group
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
