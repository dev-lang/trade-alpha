from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True)
    password = Column(String)
    balance_ars = Column(Float, default=10000000)
    balance_usd = Column(Float, default=10000)

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    side = Column(String)
    price = Column(Float)
    quantity = Column(Float)
    remaining = Column(Float)
    status = Column(String, default="open")
    timestamp = Column(DateTime, default=datetime.utcnow)

class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True)
    buy_order_id = Column(Integer)
    sell_order_id = Column(Integer)
    price = Column(Float)
    quantity = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)