let previousMid = null;

const socket = new WebSocket("ws://127.0.0.1:8000/ws");

const clockDiv = document.getElementById("clock");

socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    renderBook(data);
};

socket.onerror = function(error) {
    console.log("WebSocket error:", error);
};

socket.onclose = function() {
    console.log("WebSocket closed");
};

let previousBids = [];
let previousAsks = [];

function renderBook(data) {

    const container = document.getElementById("bookRows");
    container.innerHTML = "";

    const bids = data.bids || [];
    const asks = data.asks || [];

    const maxDepth = 10;

    const paddedBids = bids.slice(0, maxDepth);
    const paddedAsks = asks.slice(0, maxDepth);

    while (paddedBids.length < maxDepth) paddedBids.push(null);
    while (paddedAsks.length < maxDepth) paddedAsks.push(null);

    paddedBids.reverse();

    const maxBidQty = Math.max(...bids.map(b => b.quantity), 1);
    const maxAskQty = Math.max(...asks.map(a => a.quantity), 1);

    for (let i = 0; i < maxDepth; i++) {

        const bid = paddedBids[i];
        const ask = paddedAsks[i];

        const bidIntensity = bid ? (bid.quantity / maxBidQty) * 100 : 0;
        const askIntensity = ask ? (ask.quantity / maxAskQty) * 100 : 0;

        const row = document.createElement("div");
        row.className = "book-row animate-in";

        const isBestBid = bid && bids[0] && bid.price === bids[0].price;
        const isBestAsk = ask && asks[0] && ask.price === asks[0].price;

        // -------- DETECCIÓN SEGURA DE CAMBIOS --------

        const previousBidLevel = previousBids?.find(b => b.price === bid?.price);
        const previousAskLevel = previousAsks?.find(a => a.price === ask?.price);

        const bidChanged =
            bid && previousBidLevel && previousBidLevel.quantity !== bid.quantity;

        const askChanged =
            ask && previousAskLevel && previousAskLevel.quantity !== ask.quantity;

        row.innerHTML = `
            <div class="bid-qty depth-bid ${isBestBid ? 'best' : ''} ${bidChanged ? 'flash-green' : ''}"
                 style="background: linear-gradient(to right, rgba(0,200,100,0.18) ${bidIntensity}%, transparent ${bidIntensity}%);">
                 ${bid ? formatNumber(bid.quantity) : ""}
            </div>

            <div class="bid-price ${isBestBid ? 'best-price' : ''}">
                ${bid ? bid.price.toFixed(3) : ""}
            </div>

            <div class="separator"></div>

            <div class="ask-price ${isBestAsk ? 'best-price' : ''}">
                ${ask ? ask.price.toFixed(3) : ""}
            </div>

            <div class="ask-qty depth-ask ${isBestAsk ? 'best' : ''} ${askChanged ? 'flash-red' : ''}"
                 style="background: linear-gradient(to left, rgba(200,50,50,0.18) ${askIntensity}%, transparent ${askIntensity}%);">
                 ${ask ? formatNumber(ask.quantity) : ""}
            </div>
        `;

        container.appendChild(row);
    }

    // -------- COPIA SEGURA PARA SIGUIENTE TICK --------

    previousBids = JSON.parse(JSON.stringify(bids));
    previousAsks = JSON.parse(JSON.stringify(asks));

    // -------- MID & SPREAD --------

    if (bids.length > 0 && asks.length > 0) {

        const bestBid = bids[0].price;
        const bestAsk = asks[0].price;

        const mid = (bestBid + bestAsk) / 2;
        const spread = bestAsk - bestBid;

        const midLine = document.getElementById("midLine");

        let direction = "";
        let directionClass = "";

        if (previousMid !== null) {
            if (mid > previousMid) {
                direction = " ↑";
                directionClass = "mid-up";
            } else if (mid < previousMid) {
                direction = " ↓";
                directionClass = "mid-down";
            }
        }

        midLine.classList.remove("mid-up", "mid-down", "mid-flash");

        if (directionClass) {
            midLine.classList.add(directionClass);
            midLine.classList.add("mid-flash");
        }

        midLine.innerHTML =
            `MID <span>${mid.toFixed(3)}</span>${direction} | Spread ${spread.toFixed(3)}`;

        previousMid = mid;
    }
}

function formatNumber(num) {
    return Number(num).toLocaleString("en-US");
}

// -------- RELOJ MERCADO --------

setInterval(() => {
    const now = new Date();

    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');

    clockDiv.innerText = `${hh}:${mm}:${ss}.${ms}`;
}, 50);

// -------- ORDER FORM --------

document.getElementById("orderForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const user_id = document.getElementById("user_id").value;
    const side = document.getElementById("side").value;
    const price = document.getElementById("price").value;
    const quantity = document.getElementById("quantity").value;

    await fetch(`/order?user_id=${user_id}&side=${side}&price=${price}&quantity=${quantity}`, {
        method: "POST"
    });

    this.reset();
});