from __future__ import annotations


def test_repair_plan_reports_resized_and_cancelled_linked_exits():
    from scripts.reconcile_exit_orders import build_reconciliation_plans

    plans = build_reconciliation_plans(
        [
            {"position_id": "P1", "status": "open", "shares": 5},
            {"position_id": "P2", "status": "closed", "shares": 5},
        ],
        [
            {
                "order_id": "S1",
                "position_id": "P1",
                "order_kind": "stop",
                "status": "pending",
                "quantity": 10,
            },
            {
                "order_id": "S2",
                "position_id": "P2",
                "order_kind": "stop",
                "status": "pending",
                "quantity": 10,
            },
            {
                "order_id": "ORPHAN-STOP",
                "position_id": "MISSING",
                "order_kind": "stop",
                "status": "pending",
                "quantity": 10,
            },
        ],
    )

    assert [
        (plan.position_id, plan.updates, plan.skipped_reason) for plan in plans
    ] == [
        ("P1", (("S1", {"quantity": 5}),), None),
        ("P2", (("S2", {"status": "cancelled"}),), None),
        (
            "MISSING",
            (),
            "Active linked protective order has no position: ORPHAN-STOP",
        ),
    ]


def test_repair_plan_is_idempotent_after_its_updates_are_applied():
    from scripts.reconcile_exit_orders import build_reconciliation_plans

    position = {"position_id": "P1", "status": "open", "shares": 5}
    orders = [
        {
            "order_id": "S1",
            "position_id": "P1",
            "order_kind": "stop",
            "status": "pending",
            "quantity": 10,
        }
    ]

    first = build_reconciliation_plans([position], orders)
    assert first[0].updates == (("S1", {"quantity": 5}),)

    orders[0].update(first[0].updates[0][1])
    assert build_reconciliation_plans([position], orders) == []
