import random
import unicodedata
from itertools import cycle

APOSTROPHES = str.maketrans({mark: "'" for mark in "‘’ʻʼ`´"})


def normalize(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).translate(APOSTROPHES).casefold().split())


def build_questions(words: list[dict], mode: str) -> list[dict]:
    shuffled = random.sample(words, k=len(words))
    translations = list({normalize(word["translation"]): word["translation"] for word in words}.values())
    headings = list({word["heading"] for word in words if word["heading"]})
    random.shuffle(headings)
    kinds = (mode,)
    if mode == "mixed":
        kinds = ("written", "matching", "headings") if headings else ("written", "matching")
    questions = []
    for index, (word, kind) in enumerate(zip(shuffled, cycle(kinds)), start=1):
        expected = word["heading"] if kind == "headings" else word["translation"]
        distractors = [text for text in translations if normalize(text) != normalize(expected)]
        options = []
        if kind == "matching":
            options = [expected, *random.sample(distractors, k=min(4, len(distractors)))]
            random.shuffle(options)
        elif kind == "headings":
            options = headings
        questions.append({"id": str(index), "kind": kind, "term": word["term"], "options": options, "expected": expected})
    return questions


def score(questions: list[dict], answers: dict[str, str]) -> int:
    return sum(normalize(answers.get(item["id"], "")) == normalize(item["expected"]) for item in questions)
