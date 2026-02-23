from sqlalchemy.orm import Session
from models import Order, Trade, User
from datetime import datetime

class MatchingEngine:

    def match(self, db: Session, new_order: Order):

        if new_order.side == "buy":
            opposite_orders = db.query(Order).filter(
                Order.side == "sell",
                Order.price <= new_order.price,
                Order.status == "open"
            ).order_by(Order.price.asc(), Order.timestamp.asc()).all()
        else:
            opposite_orders = db.query(Order).filter(
                Order.side == "buy",
                Order.price >= new_order.price,
                Order.status == "open"
            ).order_by(Order.price.desc(), Order.timestamp.asc()).all()

        for order in opposite_orders:
            if new_order.remaining <= 0:
                break

            trade_qty = min(new_order.remaining, order.remaining)

            trade = Trade(
                buy_order_id=new_order.id if new_order.side == "buy" else order.id,
                sell_order_id=new_order.id if new_order.side == "sell" else order.id,
                price=order.price,
                quantity=trade_qty,
                timestamp=datetime.utcnow()
            )

            db.add(trade)

            new_order.remaining -= trade_qty
            order.remaining -= trade_qty

            if order.remaining == 0:
                order.status = "filled"

        if new_order.remaining == 0:
            new_order.status = "filled"

        db.commit()