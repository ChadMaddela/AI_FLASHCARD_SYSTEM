import React from "react";
import "../styles/Spinner.css";

/** A small spinning ring. size: "sm" | "lg" (default "lg"). */
const Spinner = ({ size = "lg" }) => (
    <div className={`app-spinner ${size === "sm" ? "app-spinner-sm" : "app-spinner-lg"}`} />
);

export default Spinner;
