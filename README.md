# Bitespeed Backend Task – Identity Reconciliation

## 📌 Overview

This service identifies and consolidates customer identities based on email and phone number.

A customer may have multiple contact records in the database.  
The system ensures:

- Exactly one **primary** contact per identity cluster
- All related contacts marked as **secondary**
- The oldest contact remains primary during reconciliation
- Identity trees are flattened after merge

---

## 🌍 Live API

Base URL:

https://bitespeed-assignment-5aya.onrender.com

> Note: Hosted on Render free tier, the first request may take a few seconds due to cold start.

---

## 📬 Endpoint

### `POST /identify`

### Request Body

```json
{
  "email": "test@example.com",
  "phoneNumber": "123456"
}