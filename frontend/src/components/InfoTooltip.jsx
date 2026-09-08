import React, { useState } from "react";
import "../styles/InfoTooltip.css";

/** A small clickable ⓘ icon that reveals a plain-language explanation of a report/metric. */
const InfoTooltip = ({ text }) => {
  const [show, setShow] = useState(false);

  return (
    <span className="info-tooltip-wrapper">
      <button
        type="button"
        className="info-tooltip-icon"
        onClick={() => setShow((s) => !s)}
        aria-label="What does this mean?"
      >
        ⓘ
      </button>
      {show && (
        <span className="info-tooltip-bubble">
          {text}
        </span>
      )}
    </span>
  );
};

export default InfoTooltip;
