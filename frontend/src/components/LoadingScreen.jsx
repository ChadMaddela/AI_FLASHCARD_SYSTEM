import React from "react";
import Spinner from "./Spinner";
import "../styles/Spinner.css";

/**
 * Visible loading feedback for a full page (fullPage=true, default) or an
 * already-rendered section (fullPage=false), replacing static "Loading..." text.
 */
const LoadingScreen = ({ message = "Loading...", fullPage = true }) => (
    <div className={fullPage ? "loading-screen-wrapper" : "loading-screen-inline"}>
        <Spinner size={fullPage ? "lg" : "sm"} />
        <p className="loading-screen-message">{message}</p>
    </div>
);

export default LoadingScreen;
