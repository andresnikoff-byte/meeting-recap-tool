(function () {
  const app = document.getElementById("app");

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderInvalid() {
    app.innerHTML = `<p class="sub">This link looks broken or incomplete. <a href="/">Generate a new recap →</a></p>`;
  }

  function render(result) {
    const actionItemsHtml =
      !result.actionItems || result.actionItems.length === 0
        ? `<p style="color:var(--text-dim)">No action items on this recap.</p>`
        : result.actionItems
            .map(
              (item) => `
          <div class="action-item">
            <span class="owner">${escapeHtml(item.owner || "Unassigned")}</span>
            <span>${escapeHtml(item.task || "")}</span>
          </div>`
            )
            .join("");

    const topicsHtml =
      result.topics && result.topics.length > 0
        ? `<h2>Topics</h2><p>${escapeHtml(result.topics.join(" · "))}</p>`
        : "";

    app.innerHTML = `
      <div class="shared-banner">Shared recap — view only. <a href="/">Generate your own →</a></div>
      <h1>Meeting recap</h1>
      <div class="card result" style="display:block">
        <h2>Summary</h2>
        <p>${escapeHtml(result.summary || "")}</p>
        <h2>Action items</h2>
        ${actionItemsHtml}
        ${topicsHtml}
      </div>
    `;
  }

  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) {
    renderInvalid();
    return;
  }
  try {
    const json = decodeURIComponent(escape(atob(hash)));
    const parsed = JSON.parse(json);
    render(parsed);
  } catch (err) {
    renderInvalid();
  }
})();
