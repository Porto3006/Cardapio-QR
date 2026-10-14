"""Idempotent Stripe catalog setup for PratoDigital subscription plans (BRL, monthly)."""
import os, stripe
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env')

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"

CATALOG = [
    {"emergent_product_id": "plano_simples", "name": "PratoDigital - Plano Simples", "tax_code": "txcd_10103001",
     "prices": [{"lookup_key": "plano_simples_mensal", "amount": 4900, "currency": "brl", "interval": "month"}]},
    {"emergent_product_id": "plano_intermediario", "name": "PratoDigital - Plano Intermediário", "tax_code": "txcd_10103001",
     "prices": [{"lookup_key": "plano_intermediario_mensal", "amount": 9900, "currency": "brl", "interval": "month"}]},
    {"emergent_product_id": "plano_avancado", "name": "PratoDigital - Plano Avançado", "tax_code": "txcd_10103001",
     "prices": [{"lookup_key": "plano_avancado_mensal", "amount": 18900, "currency": "brl", "interval": "month"}]},
]


def ensure_tax_settings():
    try:
        s = stripe.tax.Settings.retrieve()
        if s.head_office and getattr(s.head_office, "address", None):
            return
        stripe.tax.Settings.modify(
            head_office={"address": {"country": "BR", "line1": "Av. Paulista, 1000", "city": "São Paulo", "state": "SP", "postal_code": "01310-100"}},
            defaults={"tax_behavior": "inclusive"},
        )
        print("Tax settings configured")
    except Exception as e:
        print(f"Tax settings skipped: {e}")


def get_or_create_product(entry):
    for p in stripe.Product.list(active=True).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            return p
    return stripe.Product.create(name=entry["name"], tax_code=entry.get("tax_code"),
        metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]})


def run():
    ensure_tax_settings()
    for entry in CATALOG:
        product = get_or_create_product(entry)
        for p in entry["prices"]:
            existing = stripe.Price.list(lookup_keys=[p["lookup_key"]], active=True, limit=1).data
            if existing and (existing[0].unit_amount != p["amount"] or existing[0].currency != p["currency"]):
                stripe.Price.modify(existing[0].id, active=False)
                existing = []
            if not existing:
                stripe.Price.create(product=product.id, unit_amount=p["amount"], currency=p["currency"],
                    lookup_key=p["lookup_key"], transfer_lookup_key=True, recurring={"interval": p["interval"]})
                print(f"Created price {p['lookup_key']}")
            else:
                print(f"Price exists {p['lookup_key']}")
    print("Catalog setup done")


if __name__ == "__main__":
    run()
