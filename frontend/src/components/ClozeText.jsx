import React from "react";

/** Renders text containing a "_____" blank with the blank visually emphasized, so it's
 * unambiguous which word is missing. Plain text with no blank renders unchanged. */
const ClozeText = ({ text }) => {
  if (!text || !text.includes("_____")) return <>{text}</>;

  const parts = text.split("_____");
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && <span className="cloze-blank">_____</span>}
        </React.Fragment>
      ))}
    </>
  );
};

export default ClozeText;
