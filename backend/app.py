from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
from pyzbar.pyzbar import decode
import winsound
import csv
import os
import requests
import base64
import numpy as np

app = Flask(__name__)
CORS(app)  # Cho phép React kết nối

# Tên file CSV
csv_file = "products.csv"

# Nếu file chưa tồn tại thì tạo mới với header
if not os.path.exists(csv_file):
    with open(csv_file, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["Barcode", "Name", "Brand", "Quantity"])

# Hàm tra cứu sản phẩm từ Open Food Facts
def lookup_product(barcode):
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == 1:  # tìm thấy
                product = data["product"]
                name = product.get("product_name", "Unknown")
                brand = product.get("brands", "Unknown")
                return name, brand
    except Exception as e:
        print("API error:", e)
    return "Unknown", "Unknown"

# Hàm cập nhật CSV
def update_csv(barcode_data):
    rows = []
    found = False

    with open(csv_file, mode="r", newline="", encoding="utf-8") as file:
        reader = csv.reader(file)
        rows = list(reader)

    header = rows[0]
    data_rows = rows[1:]

    for row in data_rows:
        if row[0] == barcode_data:
            row[3] = str(int(row[3]) + 1)  # tăng số lượng
            found = True
            break

    if not found:
        name, brand = lookup_product(barcode_data)
        data_rows.append([barcode_data, name, brand, "1"])

    with open(csv_file, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(header)
        writer.writerows(data_rows)

    # Trả về thông tin sản phẩm
    if found:
        return {"barcode": barcode_data, "name": row[1], "brand": row[2], "quantity": row[3]}
    else:
        return {"barcode": barcode_data, "name": name, "brand": brand, "quantity": "1"}

# API endpoint để quét mã vạch
@app.route('/scan', methods=['POST'])
def scan_barcode():
    try:
        # Nhận ảnh từ frontend (dạng base64)
        data = request.get_json()
        image_data = data['image'].split(',')[1]  # Bỏ phần header base64
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Quét mã vạch
        detectedBarcode = decode(frame)
        
        if detectedBarcode:
            for barcode in detectedBarcode:
                barcode_data = barcode.data.decode("utf-8")
                barcode_type = barcode.type
                
                # Cập nhật CSV và lấy thông tin sản phẩm
                product_info = update_csv(barcode_data)
                
                # Phát âm thanh (nếu đang chạy trên Windows)
                try:
                    winsound.Beep(1000, 150)
                except:
                    pass  # Bỏ qua nếu không phải Windows
                
                return jsonify({
                    "success": True,
                    "barcode": barcode_data,
                    "type": barcode_type,
                    "product": product_info
                })
        
        return jsonify({"success": False, "message": "No barcode detected"})
    
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# API endpoint để lấy lịch sử sản phẩm
@app.route('/products', methods=['GET'])
def get_products():
    try:
        products = []
        with open(csv_file, mode="r", newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            for row in reader:
                products.append(row)
        return jsonify(products)
    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == '__main__':
    app.run(debug=True, port=5000)