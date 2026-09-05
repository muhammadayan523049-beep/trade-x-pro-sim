# TradeX Dashboard

Build a modern, professional trading broker platform called TradeX.

The platform should have a clean, premium fintech UI inspired by professional trading platforms, but with an original design.

Core Features

Landing Page

Professional hero section

“Trade Smarter. Invest Better.” headline

CTA buttons: Open Account, Login, Start Trading

Features section

Markets overview

Trading benefits

Security section

Pricing/fees section

FAQ

Footer with legal links

User Authentication

Sign up

Login

Forgot password

Email verification

2FA UI

Demo account and Live account selection

User Dashboard Create a professional trading dashboard showing:

Total balance

Available margin

Equity

Used margin

Free margin

Today's P/L

Overall P/L

Open positions

Pending orders

Recent transactions

Watchlist

Market overview

Trading Terminal Build a responsive trading interface with:

Symbol search

Live-style price display

Interactive candlestick chart

Timeframes: 1m, 5m, 15m, 1H, 4H, 1D

Technical indicators UI

Buy/Sell buttons

Order type: Market, Limit, Stop

Quantity/lot input

Stop Loss

Take Profit

Risk/reward preview

Estimated margin

Order confirmation modal

Open positions table

Modify position

Close position

Order history

Markets Create market categories:

Forex

Stocks

Crypto

Indices

Commodities

Each market should display:

Symbol

Current price

Bid

Ask

Spread

Daily change

Percentage change

Trading status

Use realistic demo market data and clearly label it as demo/simulated data.

Portfolio

Portfolio value

Asset allocation

Holdings

Average entry price

Current price

Unrealized P/L

Realized P/L

Performance chart

Wallet / Funds Create:

Deposit page

Withdrawal page

Transaction history

Payment method management

Deposit/withdrawal status

Account balance

For the MVP, use simulated transactions only. Do not connect to real payment providers unless explicitly configured later.

KYC / Verification Create a professional verification flow:

Personal information

Address

Identity document upload UI

Proof of address

Verification status

Pending / Approved / Rejected states

Do not actually process identity documents in the MVP; create the frontend flow and secure placeholder backend architecture.

User Profile & Settings

Personal details

Security settings

Password change

2FA

Notification preferences

Trading preferences

Language

Theme

Admin Dashboard Create an admin panel with:

Total users

Active users

Pending KYC

Deposits

Withdrawals

Trading volume

Open positions

User management

KYC management

Deposit/withdrawal management

Trading activity

System settings

Audit logs

Backend Architecture

Use Supabase for:

Authentication

PostgreSQL database

Row Level Security

User profiles

Accounts

Wallets

Orders

Positions

Transactions

KYC status

Watchlists

Notifications

Audit logs

Create a clean relational database schema with proper foreign keys, indexes, timestamps, and RLS policies.

Trading Engine

For the MVP, create a paper-trading/simulation engine, not a real brokerage execution system.

Implement:

Market orders

Limit orders

Stop orders

Position tracking

Balance calculations

P/L calculations

Margin calculations

Order status

Trade history

Use mock market-price feeds that can later be replaced by a licensed market-data provider/API.

Clearly separate:

Frontend

Trading service

Market data service

Database

Authentication

Admin functionality

UI/UX

Responsive desktop, tablet, and mobile design

Dark trading-terminal theme

Professional fintech appearance

Sidebar navigation

Top navigation with account information

Cards with subtle borders

Interactive charts

Clean tables

Toast notifications

Loading states

Empty states

Error states

Confirmation dialogs

Make the trading terminal feel like a real professional broker platform while keeping the implementation suitable for a demo/paper-trading MVP.

Security

Implement:

Supabase authentication

Row Level Security

Role-based access control

Admin/user separation

Server-side validation

Input validation

Secure database policies

Audit logging

Never expose secret API keys or service-role keys in frontend code.

Important

This is a demo/paper-trading broker MVP. Do not claim that it executes real trades, holds customer funds, provides investment advice, or is a regulated brokerage.

Add appropriate UI disclaimers that prices and trading are simulated.

Build the application with reusable components, clean architecture, production-quality UI, and scalable code. Start with the complete frontend and Supabase schema, then implement the paper-trading functionality. Is me jo pehla account bane ga wo admin hoga har chees controll karega or email se verification nahi rakhna login karke seedha dashboard oe direct jayn

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://trade-x-pro-sim.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cb23dd31-55dc-42d1-9cd9-2eb50056b01c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
