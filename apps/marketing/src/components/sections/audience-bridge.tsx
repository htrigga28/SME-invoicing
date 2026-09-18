import { audienceBridge } from "@/content/site-copy";

export function AudienceBridge() {
  return (
    <section aria-label="Who Lumina is for" className="audience-section">
      <div className="shell-container audience-band">
        <h2>{audienceBridge.heading}</h2>
        <ul className="audience-groups">
          {audienceBridge.groups.map((group) => (
            <li key={group.title}>
              <strong>{group.title}</strong>
              <p>{group.copy}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
