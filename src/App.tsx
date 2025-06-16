import { useState } from "react";
import UpdateElectron from "@/components/update";
import logoVite from "./assets/logo-vite.svg";
import logoElectron from "./assets/logo-electron.svg";
import "./App.css";
import ConfigForm from "@/components/configForm";

function App() {
  return (
    <div className="App">
      <ConfigForm />
    </div>
  );
}

export default App;
