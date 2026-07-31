"""
Server-side PDF rendering for teacher-facing analytics/assessment reports.
Each render_* function takes the exact dict already returned by the matching
compute_* function in analytics.py/reports.py and returns raw PDF bytes —
pure rendering, no new computation, no new edge cases beyond what those
functions already handle.
"""
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

_styles = getSampleStyleSheet()
_TITLE_STYLE = ParagraphStyle("ReportTitle", parent=_styles["Title"], fontSize=18, spaceAfter=4)
_SUBTITLE_STYLE = ParagraphStyle("ReportSubtitle", parent=_styles["Normal"], fontSize=10, textColor=colors.grey, spaceAfter=16)
_SECTION_STYLE = ParagraphStyle("SectionHeading", parent=_styles["Heading2"], fontSize=13, spaceBefore=16, spaceAfter=6)
_METRIC_STYLE = ParagraphStyle("Metrics", parent=_styles["Normal"], fontSize=11, spaceAfter=10)
_CELL_STYLE = ParagraphStyle("Cell", parent=_styles["Normal"], fontSize=8.5, leading=10.5)
_EMPTY_STYLE = ParagraphStyle("Empty", parent=_styles["Normal"], fontSize=9.5, textColor=colors.grey, spaceAfter=10)

HEADER_BG = colors.HexColor("#1f2a44")
ROW_ALT_BG = colors.HexColor("#f2f4f8")
GRID_COLOR = colors.HexColor("#cbd5e1")

BLOOM_LEVEL_LABELS = {
    "REMEMBERING": "Remembering",
    "UNDERSTANDING": "Understanding",
    "APPLYING": "Applying",
    "ANALYZING": "Analyzing",
    "EVALUATING": "Evaluating",
    "CREATING": "Creating",
}
BLOOM_LEVEL_ORDER = list(BLOOM_LEVEL_LABELS.keys())


def _cell(value):
    """Wraps text in a Paragraph so it wraps inside a table cell instead of overflowing."""
    return Paragraph(str(value), _CELL_STYLE)


def _document(landscape_mode=False):
    buffer = io.BytesIO()
    pagesize = landscape(letter) if landscape_mode else letter
    doc = SimpleDocTemplate(
        buffer, pagesize=pagesize,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
    )
    return doc, buffer


def _header_flowables(title, subtitle=None):
    generated = f"Generated on {datetime.now().strftime('%B %d, %Y %I:%M %p')}"
    meta = f"{subtitle} - {generated}" if subtitle else generated
    return [Paragraph(title, _TITLE_STYLE), Paragraph(meta, _SUBTITLE_STYLE)]


def _section(heading, table_or_empty_message):
    flowables = [Paragraph(heading, _SECTION_STYLE)]
    if isinstance(table_or_empty_message, str):
        flowables.append(Paragraph(table_or_empty_message, _EMPTY_STYLE))
    else:
        flowables.append(table_or_empty_message)
    return flowables


def _styled_table(header_row, data_rows, col_widths=None):
    table_data = [header_row] + data_rows
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.5, GRID_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT_BG]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def _render(title, subtitle, flowables, landscape_mode=False):
    doc, buffer = _document(landscape_mode=landscape_mode)
    doc.build(_header_flowables(title, subtitle) + flowables)
    return buffer.getvalue()


def _topic_breakdown_table(topic_breakdown):
    if not topic_breakdown:
        return "No sub-topic data yet."
    rows = [[_cell(r["sub_topic"]), str(r["avg_mastery"]), f'{r["accuracy_percentage"]}%'] for r in topic_breakdown]
    return _styled_table(["Sub-topic", "Avg. Mastery", "Accuracy"], rows, col_widths=[3.2 * inch, 1.5 * inch, 1.5 * inch])


def _confidence_breakdown_table(confidence_breakdown):
    if not confidence_breakdown:
        return "No confidence ratings yet."
    labels = {"GUESSING": "Guessing", "UNSURE": "Unsure", "CONFIDENT": "Confident"}
    rows = [
        [labels.get(r["confidence"], r["confidence"]), str(r["total"]), f'{r["accuracy_percentage"]}%']
        for r in confidence_breakdown
    ]
    return _styled_table(
        ["Confidence Level", "Times Rated", "Accuracy When Rated This Way"], rows,
        col_widths=[2.2 * inch, 1.5 * inch, 2.5 * inch],
    )


def render_class_analytics_pdf(class_data):
    metrics = Paragraph(
        f"Students: {class_data['student_count']} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"Class Accuracy: {class_data['class_accuracy_percentage']}%",
        _METRIC_STYLE,
    )
    flowables = [metrics]
    flowables += _section("Breakdown by Sub-topic", _topic_breakdown_table(class_data["topic_breakdown"]))
    flowables += _section("Confidence Calibration", _confidence_breakdown_table(class_data["confidence_breakdown"]))
    return _render("Class Analytics Report", None, flowables)


def render_student_analytics_pdf(student, student_data):
    metrics = Paragraph(
        f"Cards Seen: {student_data['cards_seen']} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"Cards Mastered: {student_data['cards_mastered']} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"Cards Due Now: {student_data['cards_due']} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"Overall Accuracy: {student_data['accuracy_percentage']}%",
        _METRIC_STYLE,
    )
    flowables = [metrics]

    mastery_rows = [[f"Level {row['mastery_level']}", str(row["count"])] for row in student_data["mastery_distribution"]]
    mastery_table = _styled_table(["Mastery Level", "Cards"], mastery_rows, col_widths=[3 * inch, 2 * inch])
    flowables += _section("Mastery Distribution", mastery_table)

    flowables += _section("Breakdown by Sub-topic", _topic_breakdown_table(student_data["topic_breakdown"]))
    flowables += _section("Confidence Calibration", _confidence_breakdown_table(student_data["confidence_breakdown"]))
    return _render("Student Analytics Report", student.username, flowables)


def render_tos_pdf(tos_data):
    metrics = Paragraph(
        f"Total Items: {tos_data['total_items']} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"Total Hours: {tos_data['total_hours']}",
        _METRIC_STYLE,
    )
    flowables = [metrics]

    if not tos_data["topics"]:
        flowables += _section("Table of Specifications", "No topics to report.")
    else:
        header = ["Topic", "Hours", "% Weight", "Ideal", "Actual"] + [BLOOM_LEVEL_LABELS[l] for l in BLOOM_LEVEL_ORDER]
        rows = []
        for row in tos_data["topics"]:
            rows.append([
                _cell(row["sub_topic"]), str(row["hours"]), f'{row["percentage_weight"]}%',
                str(row["ideal_item_count"]), str(row["actual_item_count"]),
            ] + [str(row["bloom_breakdown"].get(level, 0)) for level in BLOOM_LEVEL_ORDER])
        table = _styled_table(header, rows, col_widths=[1.5 * inch, 0.6 * inch, 0.7 * inch, 0.55 * inch, 0.55 * inch] + [0.85 * inch] * 6)
        flowables += _section("Table of Specifications", table)

    return _render("Table of Specifications", tos_data["quiz_title"], flowables, landscape_mode=True)


def render_item_analysis_pdf(item_analysis_data):
    note = f"Based on {item_analysis_data['completed_attempts']} completed attempt(s)."
    if item_analysis_data["insufficient_data_for_discrimination"]:
        note += " Discrimination index needs at least 2 completed attempts."
    flowables = [Paragraph(note, _METRIC_STYLE)]

    items = item_analysis_data["items"]
    if not items:
        flowables += _section("Item Analysis", "This quiz has no items.")
        return _render("Item Analysis Report", item_analysis_data["quiz_title"], flowables, landscape_mode=True)

    summary_header = ["#", "Item", "Topic", "Bloom Level", "Difficulty (p)", "Discrimination (D)"]
    summary_rows = []
    for idx, item in enumerate(items, start=1):
        discrimination = "N/A" if item["discrimination_index"] is None else f'{item["discrimination_index"]} ({item["discrimination_label"]})'
        summary_rows.append([
            str(idx), _cell(item["question"]), _cell(item["sub_topic"]),
            BLOOM_LEVEL_LABELS.get(item["bloom_level"], item["bloom_level"] or "N/A"),
            f'{item["difficulty_index"]} ({item["difficulty_label"]})', discrimination,
        ])
    summary_table = _styled_table(
        summary_header, summary_rows,
        col_widths=[0.3 * inch, 2.6 * inch, 1.3 * inch, 1.1 * inch, 1.4 * inch, 1.4 * inch],
    )
    flowables += _section("Item Summary", summary_table)

    for idx, item in enumerate(items, start=1):
        distractor_rows = [
            [d["choice"], _cell(d["text"]), "Yes" if d["is_correct"] else "", f'{d["count"]} ({d["percentage"]}%)',
             str(d["upper_count"]), str(d["lower_count"]), "Non-functional" if d["flagged_non_functional"] else ""]
            for d in item["distractors"]
        ]
        distractor_table = _styled_table(
            ["Choice", "Text", "Correct?", "Chosen", "Upper Grp", "Lower Grp", "Flag"], distractor_rows,
            col_widths=[0.55 * inch, 2.6 * inch, 0.6 * inch, 1.0 * inch, 0.75 * inch, 0.75 * inch, 1.0 * inch],
        )
        flowables += _section(f"Item {idx} Distractors", distractor_table)

    return _render("Item Analysis Report", item_analysis_data["quiz_title"], flowables, landscape_mode=True)


def render_competency_mastery_pdf(mastery_data):
    note = f"Based on {mastery_data['completed_attempts']} completed attempt(s)."
    flowables = [Paragraph(note, _METRIC_STYLE)]

    topics = mastery_data["topics"]
    if not topics:
        flowables += _section("Competency Mastery", "This quiz has no items.")
        return _render("Competency Mastery Report", mastery_data["quiz_title"], flowables)

    header = ["Topic (Competency)", "Items", "Avg. Score", "Mastery Level", "# Below Mastery"]
    rows = [
        [_cell(t["sub_topic"]), str(t["item_count"]), f'{t["avg_score_percentage"]}%',
         t["mastery_level"], str(len(t["students_below_mastery"]))]
        for t in topics
    ]
    table = _styled_table(header, rows, col_widths=[2 * inch, 0.7 * inch, 1 * inch, 2.1 * inch, 1.2 * inch])
    flowables += _section("Mastery by Topic", table)

    for t in topics:
        if not t["students_below_mastery"]:
            continue
        names = ", ".join(f'{s["username"]} ({s["score_percentage"]}%)' for s in t["students_below_mastery"])
        flowables.append(Paragraph(f'<b>{t["sub_topic"]}</b> - students below mastery: {names}', _CELL_STYLE))
        flowables.append(Spacer(1, 8))

    return _render("Competency Mastery Report", mastery_data["quiz_title"], flowables)
