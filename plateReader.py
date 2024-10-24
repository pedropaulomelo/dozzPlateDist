# det.py

import cv2
from ultralytics import YOLO
import numpy as np
import argparse
import string
import easyocr
import os
from datetime import datetime
import sys

# Função para obter o caminho dos recursos, adaptado para o PyInstaller
def get_resource_path(relative_path):
    """Obtenha o caminho absoluto para o recurso, funcionando para Dev e PyInstaller."""
    try:
        # PyInstaller cria uma pasta temporária e armazena o caminho em _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

# Inicializar o leitor OCR
reader = easyocr.Reader(['en'], gpu=False)

# Dicionários de mapeamento para conversão de caracteres
dict_char_to_int = {'O': '0', 'I': '1', 'Z': '2', 'J': '3', 'A': '4', 'S': '5', 'G': '6', 'B': '8'}
dict_int_to_char = {'0': 'O', '1': 'I', '2': 'Z', '3': 'J', '4': 'A', '5': 'S', '6': 'G', '8': 'B'}

def license_complies_format(text):
    """Verifica se o texto da placa de licença está no formato correto."""
    if len(text) != 7:
        return False

    mapping = [
        dict_int_to_char,  # Caractere 0
        dict_int_to_char,  # Caractere 1
        dict_int_to_char,  # Caractere 2
        dict_char_to_int,  # Caractere 3
        dict_int_to_char,  # Caractere 4
        dict_char_to_int,  # Caractere 5
        dict_char_to_int   # Caractere 6
    ]

    for i in range(7):
        valid_chars = string.ascii_uppercase if i != 3 and i != 5 and i != 6 else '0123456789'
        valid_chars += ''.join(mapping[i].keys())
        if text[i] not in valid_chars:
            return False

    return True

def format_license(text):
    """Formata o texto da placa de licença convertendo caracteres usando os dicionários de mapeamento."""
    license_plate_formatted = ''
    mapping = [
        dict_int_to_char,  # Caractere 0
        dict_int_to_char,  # Caractere 1
        dict_int_to_char,  # Caractere 2
        dict_char_to_int,  # Caractere 3
        dict_int_to_char,  # Caractere 4
        dict_char_to_int,  # Caractere 5
        dict_char_to_int   # Caractere 6
    ]

    for i in range(7):
        char = text[i]
        if char in mapping[i]:
            license_plate_formatted += mapping[i][char]
        else:
            license_plate_formatted += char

    return license_plate_formatted

def read_license_plate(license_plate_crop):
    """Lê o texto da placa de licença a partir da imagem recortada."""
    detections = reader.readtext(license_plate_crop)
    for detection in detections:
        bbox, text, score = detection

        text = text.upper().replace(' ', '')
        result = {
            'license_plate': {
                'text': text,
                'text_score': score,
            }
        }
        if score > 0.2 and license_complies_format(text):
            result['license_plate']['text'] = format_license(text)

            return result['license_plate']['text'], result['license_plate']['text_score']
    return None, None

def main():

    # Configurar os argumentos de linha de comando
    parser = argparse.ArgumentParser(description='Processamento de leitura de placas veiculares.')
    parser.add_argument('--ip', required=True, help='Endereço IP da câmera')
    parser.add_argument('--user', required=True, help='Usuário da câmera')
    parser.add_argument('--password', required=True, help='Senha da câmera')
    args = parser.parse_args()

    # Carregar o modelo YOLO
    model_path = get_resource_path('models/lprModel.pt')
    model = YOLO(model_path)

    # Montar a URL do vídeo com base nos argumentos
    video_path = f'rtsp://{args.user}:{args.password}@{args.ip}:554/cam/realmonitor?channel=1&subtype=0'

    cap = cv2.VideoCapture(video_path)

    # Verificar se o vídeo foi aberto corretamente
    if not cap.isOpened():
        print("Erro ao abrir o vídeo")
        sys.exit(1)
    else:
        print("Process Started Successfully")

    # Obter a taxa de frames do vídeo
    fps = cap.get(cv2.CAP_PROP_FPS)

    # Calcular o número de frames para pular para analisar aproximadamente 6 frames por segundo
    skip_frames = int(fps / 3) if fps > 0 else 1  # Evitar divisão por zero

    # Contador para acompanhar o número atual de frames
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()

        if not ret:
            break

        # Processar apenas a cada 'skip_frames' frames
        if frame_count % skip_frames == 0:
            results = model.track(frame, persist=True)

            for box in results[0].boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                license_plate_crop = frame[y1:y2, x1:x2]

                # Ler a placa de licença
                license_text, confidence = read_license_plate(license_plate_crop)

                # Verificar se a confiança é maior que 0.2 e exibir o texto
                if license_text is not None and confidence > 0.2:
                    print(f"LP-//{license_text}//-LP")

        frame_count += 1

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Ocorreu um erro: {e}")
        sys.exit(1)