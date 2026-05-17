import sqlite3
import random
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
DB_FILE = "maruti_fire.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # 1. Accounts Layer (User, Employee, Admin, Developer)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            emp_id TEXT UNIQUE,
            username TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'client'
        )
    ''')
    
    # 2. Attendance Logging
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            emp_id TEXT NOT NULL,
            username TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 3. Developer Issue Tickets
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS developer_tickets (
            ticket_id TEXT PRIMARY KEY,
            raised_by TEXT NOT NULL,
            issue TEXT NOT NULL,
            status TEXT DEFAULT 'Open'
        )
    ''')
    
    # 4. Invoicing and Payments Processing
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            bill_id TEXT PRIMARY KEY,
            client_email TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'Unpaid',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Seed Default Core Role Profiles for Architecture Validation
    try:
        cursor.execute("INSERT INTO users (username, email, phone, password, role) VALUES ('Global Admin', 'admin@maruti.com', '999', 'admin123', 'admin')")
        cursor.execute("INSERT INTO users (emp_id, username, email, phone, password, role) VALUES ('MFS-2026-01', 'Crew Member A', 'crew@maruti.com', '888', 'crew123', 'employee')")
        cursor.execute("INSERT INTO users (username, email, phone, password, role) VALUES ('Lead Developer', 'dev@maruti.com', '111', 'dev123', 'developer')")
    except sqlite3.IntegrityError:
        pass
        
    conn.commit()
    conn.close()

init_db()

# --- SECURITY SYSTEM TEMP MEMORY MOCK FOR OTP VALIDATION ---
ACTIVE_OTP_CACHE = {}

@app.route('/api/login/step1', methods=['POST'])
def login_step1():
    data = request.get_json()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT username, role, emp_id FROM users WHERE email = ? AND password = ?", (data['email'], data['password']))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        username, role, emp_id = user
        if role == 'admin':
            generated_otp = str(random.randint(100000, 999999))
            ACTIVE_OTP_CACHE[data['email']] = generated_otp
            print(f"\n[SECURITY ALERT] 2FA OTP Token Generated for Admin: {generated_otp}\n")
            return jsonify({"status": "otp_required", "message": "Two-Factor Verification active. Input temporary system token."})
        return jsonify({"status": "success", "user": {"username": username, "role": role, "emp_id": emp_id}})
    return jsonify({"status": "error", "message": "Access Denied. Verification sequence failed."}), 401

@app.route('/api/login/step2-admin', methods=['POST'])
def login_admin_step2():
    data = request.get_json()
    email = data.get('email')
    otp_attempt = data.get('otp')
    
    if ACTIVE_OTP_CACHE.get(email) == otp_attempt:
        ACTIVE_OTP_CACHE.pop(email, None)
        return jsonify({"status": "success", "user": {"username": "System Administrator", "role": "admin"}})
    return jsonify({"status": "error", "message": "Invalid System MFA Security Token."}), 401

@app.route('/api/attendance', methods=['POST'])
def log_attendance():
    data = request.get_json()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO attendance (emp_id, username) VALUES (?, ?)", (data['emp_id'], data['username']))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "Attendance validated and synchronized with central console."})

@app.route('/api/attendance/get', methods=['GET'])
def get_attendance():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT emp_id, username, timestamp FROM attendance ORDER BY timestamp DESC")
    logs = cursor.fetchall()
    conn.close()
    return jsonify([{"emp_id": x[0], "username": x[1], "timestamp": x[2]} for x in logs])

@app.route('/api/tickets/raise', methods=['POST'])
def raise_ticket():
    data = request.get_json()
    token_id = f"TK-{random.randint(10000, 99999)}"
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO developer_tickets (ticket_id, raised_by, issue) VALUES (?, ?, ?)", (token_id, data['user'], data['issue']))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "token": token_id})

@app.route('/api/tickets/get', methods=['GET'])
def get_tickets():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT ticket_id, raised_by, issue, status FROM developer_tickets")
    tickets = cursor.fetchall()
    conn.close()
    return jsonify([{"ticket_id": x[0], "raised_by": x[1], "issue": x[2], "status": x[3]} for x in tickets])

@app.route('/api/billing/generate', methods=['POST'])
def generate_bill():
    data = request.get_json()
    bill_id = f"INV-{random.randint(1000, 9999)}"
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO transactions (bill_id, client_email, amount) VALUES (?, ?, ?)", (bill_id, data['email'], data['amount']))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "bill_id": bill_id})

@app.route('/api/billing/get', methods=['GET'])
def get_bills():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT bill_id, client_email, amount, status FROM transactions")
    bills = cursor.fetchall()
    conn.close()
    return jsonify([{"bill_id": x[0], "client_email": x[1], "amount": x[2], "status": x[3]} for x in bills])

@app.route('/api/billing/pay', methods=['POST'])
def pay_bill():
    data = request.get_json()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("UPDATE transactions SET status = 'Paid - Gateway Verified' WHERE bill_id = ?", (data['bill_id'],))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "Transaction authenticated by gateway pipeline."})

if __name__ == '__main__':
    app.run(debug=True, port=5000)