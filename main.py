from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import Base, engine, SessionLocal
from models import Order
from engine import MatchingEngine
import asyncio

app = FastAPI()
Base.metadata.create_all(bind=engine)
matcher = MatchingEngine()

# 🔥 IMPORTANTE: montar static en /static, NO en "/"
app.mount("/static", StaticFiles(directory="static"), name="static")

connections = []


# ---------------- DB Dependency ----------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------- Order Book Logic ----------------

def build_book(db: Session):

    bids = db.query(
        Order.price,
        func.sum(Order.remaining).label("quantity")
    ).filter(
        Order.side == "buy",
        Order.status == "open"
    ).group_by(Order.price).order_by(Order.price.desc()).all()

    asks = db.query(
        Order.price,
        func.sum(Order.remaining).label("quantity")
    ).filter(
        Order.side == "sell",
        Order.status == "open"
    ).group_by(Order.price).order_by(Order.price.asc()).all()

    return {
        "bids": [{"price": b[0], "quantity": b[1]} for b in bids],
        "asks": [{"price": a[0], "quantity": a[1]} for a in asks]
    }


@app.get("/book")
def get_book(db: Session = Depends(get_db)):
    return build_book(db)


# ---------------- Broadcast ----------------

async def broadcast_book():
    if not connections:
        return

    db = SessionLocal()
    book = build_book(db)
    db.close()

    alive = []

    for conn in connections:
        try:
            await conn.send_json(book)
            alive.append(conn)
        except:
            pass

    connections.clear()
    connections.extend(alive)


# ---------------- Place Order ----------------

@app.post("/order")
async def place_order(
    user_id: int,
    side: str,
    price: float,
    quantity: float,
    db: Session = Depends(get_db)
):

    order = Order(
        user_id=user_id,
        side=side,
        price=price,
        quantity=quantity,
        remaining=quantity
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    matcher.match(db, order)

    await broadcast_book()

    return {"status": "ok"}


# ---------------- WebSocket ----------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()
    connections.append(websocket)

    # Enviar book inicial
    db = SessionLocal()
    await websocket.send_json(build_book(db))
    db.close()

    try:
        while True:
            await asyncio.sleep(3600)  # mantiene viva la conexión
    except WebSocketDisconnect:
        if websocket in connections:
            connections.remove(websocket)