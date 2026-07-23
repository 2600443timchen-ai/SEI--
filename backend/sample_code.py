#我要做一個颱風百問的機器人對話介面，作為交通部中央氣象署的官方

#記得要解析回傳的語法跟格式 => Markdown 跟 Mermaid 等等

#每個回傳答案要有「複製」的按鈕

#以下為RAG的對話API範例程式碼

#NOTE: 不要考慮安全性，直接把token與ID 帶入


import os
import json
import requests

# Settings
API_BASE_URL = "https://cloud.geminidata.com/api/v1"

PROJECT_ID = '6a439e670763de002d27d6bd'

PROJECT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNTllNTJlMDc2M2RlMDAyZDJiZDNlYyIsImlzQVBJIjp0cnVlLCJnX3VpZCI6IjZhNDNhMGVmMDc2M2RlMDAyZDI3ZTVjYyIsImdfYWRtaW4iOmZhbHNlLCJnX2RlbW9hZG1pbiI6ZmFsc2UsImdfYWNjb3VudGFkbWluIjpmYWxzZSwiZ190aWQiOiI2YTQzOWU2NzA3NjNkZTAwMmQyN2Q2YmQ6cHJvZHVjZXIiLCJnX3RpZF9wZXJtaXNzaW9uIjpbIm1ldGE6dXBkYXRlIiwic291cmNlOnJlYWQiLCJzb3VyY2U6dXBkYXRlIiwic291cmNlOmRlbGV0ZSIsImdyYXBoOnJlYWQiLCJncmFwaDp1cGRhdGUiLCJncmFwaDpkZWxldGUiLCJncmFwaDpleHBsb3JlIiwiZ3JhcGg6ZXhwb3J0IiwiY2FudmFzOmFubm90YXRlIiwiY2FudmFzOnBlcnNvbmFsaXplIiwiZGFzaGJvYXJkOnJlYWQiLCJkYXNoYm9hcmQ6dXBkYXRlIiwiY2FudmFzOnNoYXBlIl0sImdfdGlkX3BhcnNlcl9zb3VyY2UiOiJjc3YiLCJnX3RpZF9mZWF0dXJlX2FkZF9vbnMiOlsiYXNzaXN0YW50Il0sImdfYXZhdGFyIjoiMDIiLCJpc3MiOiJodHRwczovL2Nsb3VkLmdlbWluaWRhdGEuY29tIiwic3ViIjoiNmE0M2EwZWYwNzYzZGUwMDJkMjdlNWNjIiwiYXVkIjoiaHR0cHM6Ly9jbG91ZC5nZW1pbmlkYXRhLmNvbSIsImV4cCI6NDg2NjcwNTI4MiwiaWF0IjoxNzg0Mjc2MjcxLCJuaWNrbmFtZSI6Im1lbWJlcjMzQDIwMjZzZWkuY29tIiwiZW1haWwiOiJtZW1iZXIzM0AyMDI2c2VpLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZX0.MjBaj8c88E3EF5SoDW3axlQvzbiigyViP82hRqRNIuA'




def get_headers(token, project):
    return {
        'Authorization': f'Bearer {token}',
        'x-application-tenant': project
    }

def main():
    headers = get_headers(PROJECT_TOKEN, PROJECT_ID)
    
    # Get list of chats and use the last one
    response = requests.get(f'{API_BASE_URL}/chat/list', headers=headers)
    
    # 加上簡單的防呆，避免如果 Token 失效時直接報 JSONDecodeError
    if response.status_code != 200:
        print(f"取得對話列表失敗: {response.status_code}\n{response.text}")
        return

    print(f"Status Code: {response.status_code}")
    # print(f"Response Text: {response.text}") # 避免印出太多內容

    try:
        response_data = response.json()
    except requests.exceptions.JSONDecodeError:
        print("[Error] JSON 解析失敗！伺服器回傳的內容不是合法的 JSON。")
        return

    for chat in response_data:
        chatID = chat.get('_id')
        print(f'CHAT_ID: {chatID}: {chat.get("createdAt")}')
    
    # Uncomment to create a new chat
    # new_chat = requests.post(f'{API_BASE_URL}/chat/create', headers=headers, json={})
    
    # if new_chat.status_code == 200:
    #     print('NEW_CHAT: ', new_chat.text)
    #     chatID = new_chat.json().get('data', {}).get('insertedId')
    
    print(f'\nUsing CHAT_ID: {chatID}')

    if chatID:
        data = {
            # 換成你剛剛想測的那個需要等很久的問題
            'q': '請介紹颱風如何形成，並備註參考文件來源，不要有任何圖表，純文字介紹', 
            'streaming': True  # 💡 關鍵修改 1：開啟串流
        }
        
        print('REQUEST: ', data)
        print('\n⏳ 正在等待 AI 撰寫回覆，這次不會 504 了...\n')
        
        # Send chat request
        try:
            # 💡 關鍵修改 2：移除網址結尾斜線，加上 stream=True
            chat_response = requests.post(f'{API_BASE_URL}/chat/{chatID}', 
                                            headers=headers, 
                                            json=data,
                                            stream=True)
            
            # Get the result
            if chat_response.status_code == 200:
                final_result = "NO ANSWER!"
                
                # 💡 關鍵修改 3：一行一行讀取串流資料
                for line in chat_response.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        
                        # 擷取 'data: ' 後面的 JSON 字串
                        if decoded_line.startswith("data: "):
                            json_str = decoded_line.replace("data: ", "").strip()
                            if json_str:
                                try:
                                    parsed = json.loads(json_str)
                                    # 持續更新答案，最後一個 chunk 就會有完整的 result
                                    if "result" in parsed:
                                        final_result = parsed["result"]
                                except Exception:
                                    pass # 忽略解析失敗的零碎片段
                
                print("🤖 最終回覆結果:")
                print(final_result)

            else:
                print(f'Error: {chat_response.status_code}')
                print(chat_response.text)
        
        except Exception as e:
            print(f"發生錯誤: {e}")
                
if __name__ == '__main__':
    main()

