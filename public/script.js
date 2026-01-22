async function loadClients() {
  const res = await fetch("/api/clients");
  const clients = await res.json();

  const select = document.getElementById("clientSelect");
  select.innerHTML = `<option value="">Sélectionner un client</option>`;
  clients.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });
}

function addRow() {
  const row = `
  <tr>
    <td><input class="form-control desc" required></td>
    <td><input type="number" class="form-control qty" value="1" oninput="calculate()" required></td>
    <td><input type="number" class="form-control price" value="0" oninput="calculate()" required></td>
    <td><input class="form-control unit" value="M2"></td>
    <td class="lineTotal">0</td>
    <td><button type="button" class="btn btn-danger btn-sm" onclick="this.closest('tr').remove();calculate()">X</button></td>
  </tr>`;
  document.querySelector("#itemsTable tbody").insertAdjacentHTML("beforeend", row);
  calculate();
}

function calculate() {
  let subtotal = 0;
  document.querySelectorAll("#itemsTable tbody tr").forEach(tr => {
    const qty = parseFloat(tr.querySelector(".qty").value || 0);
    const price = parseFloat(tr.querySelector(".price").value || 0);
    const total = qty * price;
    tr.querySelector(".lineTotal").innerText = total;
    subtotal += total;
  });

  const rate = parseFloat(document.getElementById("tva").value || 0);
  const tva = subtotal * rate / 100;
  const total = subtotal + tva;

  document.getElementById("sub").innerText = subtotal;
  document.getElementById("tvaAmount").innerText = tva;
  document.getElementById("total").innerText = total;
}

document.getElementById("invoiceForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const items = [];
  document.querySelectorAll("#itemsTable tbody tr").forEach(tr => {
    items.push({
      description: tr.querySelector(".desc").value,
      quantity: tr.querySelector(".qty").value,
      unit_price: tr.querySelector(".price").value,
      unit: tr.querySelector(".unit").value,
    });
  });

  const payload = {
    client_id: document.getElementById("clientSelect").value,
    issue_date: document.getElementById("issue").value,
    due_date: document.getElementById("due").value,
    notes: document.getElementById("notes").value,
    tva_rate: document.getElementById("tva").value,
    items
  };

  const res = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const json = await res.json();

  document.getElementById("result").innerHTML = `
    <div class="alert alert-success">
      ✅ Facture créée : <b>${json.invoiceNumber}</b> <br>
      <a class="btn btn-primary mt-2" href="${json.pdf}" target="_blank">
        Télécharger le PDF
      </a>
    </div>
  `;
});

loadClients();
addRow();
