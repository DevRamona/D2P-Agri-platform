from pathlib import Path

from model.evaluate_paligemma import (
    PaliGemmaJsonlDataset,
    _crop_hint_for_sample,
    _extract_labels_from_suffix,
    _match_generated_label,
    _render_label_for_prompt,
)


def test_render_label_for_prompt_avoids_duplicate_crop_name():
    assert _render_label_for_prompt("bean:bean_rust") == "bean rust"
    assert _render_label_for_prompt("maize:maize_stalk_borer") == "maize stalk borer"


def test_match_generated_label_prefers_crop_hint_for_healthy():
    class_names = ["bean:healthy", "maize:healthy", "bean:bean_rust"]

    assert _match_generated_label("healthy", class_names, crop_hint="bean") == "bean:healthy"
    assert _match_generated_label("healthy", class_names, crop_hint="maize") == "maize:healthy"


def test_match_generated_label_handles_generated_disease_text():
    class_names = [
        "maize_streak_virus",
        "maize_stalk_borer",
        "bean_leaf_disease",
        "healthy",
    ]

    assert (
        _match_generated_label(
            "Disease: maize stalk borer. Advice: scout the field and remove infested plants.",
            class_names,
            crop_hint="maize",
        )
        == "maize_stalk_borer"
    )


def test_crop_hint_for_sample_uses_metadata_when_label_is_generic():
    metadata = {"crop_type": "beans"}
    assert _crop_hint_for_sample("healthy", metadata) == "bean"


def test_extract_labels_from_suffix_parses_loc_tokens():
    suffix = "<loc0000><loc0000><loc1023><loc0700> maize streak virus"
    assert _extract_labels_from_suffix(suffix) == ["maize_streak_virus"]


def test_jsonl_dataset_loads_annotations_and_skips_empty_suffix():
    fixture_path = Path(__file__).resolve().parent / "fixtures" / "paligemma_annotations.test.jsonl"
    dataset = PaliGemmaJsonlDataset(str(fixture_path))

    assert dataset.class_names == ["maize_streak_virus"]
    assert len(dataset.samples) == 1
    assert dataset.skipped_empty_suffix == 1
    assert Path(dataset.samples[0][0]).name == "tmp1.png"
