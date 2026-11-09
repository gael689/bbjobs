"""Métricas de la evaluación del RAG (R13)."""
from app.services.ai.evaluation import JobResult, decide, ndcg, stratified_sample


def test_ndcg_perfect_and_reversed():
    labels = {"a": 3, "b": 2, "c": 0}
    assert ndcg(["a", "b", "c"], labels) == 1.0
    assert ndcg(["c", "b", "a"], labels) < 0.7


def test_ndcg_ignores_unlabeled():
    assert ndcg(["x", "a", "b"], {"a": 3, "b": 1}) == 1.0


def test_stratified_sample_covers_top_middle_bottom_and_is_shuffled():
    ranked = [f"c{i}" for i in range(90)]
    sample = stratified_sample(ranked, n=30)
    idx = sorted(int(c[1:]) for c in sample)
    assert len(sample) == 30 and len(set(sample)) == 30
    assert sum(i < 30 for i in idx) == 10 and sum(i >= 60 for i in idx) == 10
    assert [int(c[1:]) for c in sample] != idx   # mezclada


def test_decision_rule_needs_two_of_three():
    two = [JobResult("1", .3, .5, .58), JobResult("2", .3, .5, .56), JobResult("3", .3, .5, .5)]
    one = [JobResult("1", .3, .5, .58), JobResult("2", .3, .5, .52), JobResult("3", .3, .5, .5)]
    assert decide(two)[0] is True and decide(one)[0] is False
