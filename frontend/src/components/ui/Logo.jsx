export default function Logo({ showName = true, nameClass = "", centered = false }) {
  return (
    <div className={`flex items-center gap-3 ${centered ? "flex-col justify-center text-center" : "min-w-0"}`}>
      <img
        src={`${import.meta.env.BASE_URL}logo.webp`}
        alt={showName ? "" : "Ké Tiendas"}
        width={centered ? 112 : 32}
        height={centered ? 112 : 32}
        className="block shrink-0 rounded-full object-contain"
      />
      {showName && <span className={`font-bold text-lg whitespace-nowrap ${nameClass}`}>Ké Tiendas</span>}
    </div>
  );
}
