export default function Switch({ checked, onChange, label = "Cambiar estado" }) {
  return (
    <button type="button" className={`sw ${checked ? "on" : ""}`} onClick={onChange} aria-label={label} aria-pressed={checked}>
      <i />
    </button>
  );
}
