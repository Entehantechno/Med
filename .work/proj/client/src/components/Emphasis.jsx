/* Render the **bold** markers the lesson text uses.

   Why this exists
   ---------------
   The micro-lessons are written with `**...**` around the phrase a student
   must not miss — the discriminating feature, the threshold, the warning. The
   lesson player rendered that text as a plain JavaScript string, so the
   asterisks reached the screen literally: a student read

       ⚠️ **کلید چاپی این سؤال نادرست بود**

   asterisks and all, and the emphasis that was supposed to guide the eye
   instead cluttered it. Found by a visual test, on a real rendered page; the
   API response was perfectly correct, which is exactly why no unit test on the
   payload could have caught it. 84 of the 98 taught questions are affected.

   Why not a markdown library
   --------------------------
   Three reasons. Speed: the bank ships hundreds of lesson strings and the site
   must stay fast, so adding a parser and its bundle to the learner's critical
   path is the wrong trade. Safety: a full markdown renderer that emits HTML
   invites an injection surface for text that partly comes from the database.
   And scope: the lessons use exactly one construct, so one construct is what
   is supported.

   This component never produces HTML. It splits on the delimiter and returns
   React elements, so the text can only ever be text.
*/
export default function Emphasis({ text, as: Tag = "span", ...rest }) {
  if (text == null || text === "") return null;
  const s = String(text);
  if (!s.includes("**")) return <Tag {...rest}>{s}</Tag>;

  // Split on the delimiter and keep it, so alternate pieces are the emphasised
  // ones. An unmatched trailing "**" therefore just renders as ordinary text
  // rather than swallowing the rest of the lesson.
  const parts = s.split("**");
  return (
    <Tag {...rest}>
      {parts.map((piece, i) =>
        i % 2 === 1 ? <strong key={i}>{piece}</strong> : <span key={i}>{piece}</span>
      )}
    </Tag>
  );
}
