/* Workspace Page Interactivity and API integration */

const getHeaders = () => ({
  'Content-Type': 'application/json'
});

let chatList = [];
let vectorKnowledgeFiles = [];
let activeChatId = null;
let activeCaseId = null;

// Mock databases
const caseDb = {
  'C-20231015-001': {
    id: 'C-20231015-001',
    applicant: '張○○（62歲）',
    status: '審查中',
    badgeClass: 'badge-review',
    type: '金融消費爭議 (投資型商品)',
    item: '理專涉嫌違反告知義務與未詳盡揭露風險',
    amount: 'NT$ 350,000',
    created: '2023-10-15',
    updated: '2023-11-02',
    summary: [
      '申請人指稱理專推薦購買外幣投資型保單時，強調「保本且固定配息 6%」，未充分揭露匯率波動及商品本金虧損之風險。',
      '申請人表示其為保守型投資人，該保單之風險等級為 High，明顯與其風險屬性不符，理專涉有過失。',
      '業者答辯稱商品說明書已由申請人簽名並聲明充分瞭解風險，且有電話回訪錄音。'
    ],
    laws: [
      {
        title: '金融消費者保護法第 9 條',
        desc: '金融服務業與金融消費者訂立契約前，應充分瞭解金融消費者之相關資料，以確保該商品或服務對金融消費者之適合度。'
      },
      {
        title: '金融消費者保護法第 10 條',
        desc: '金融服務業應向金融消費者充分說明金融商品之重要內容及風險，並進行風險揭露。說明義務應以金融消費者能理解之方式為之。'
      },
      {
        title: '民法第 184 條',
        desc: '因故意或過失，不法侵害他人之權利者，負損害賠償責任。故意以背於善良風俗之方法加損害於他人者亦同。'
      }
    ],
    initialResponse: '「合規小精靈」已為您分析完畢。此案件重點在於**理專是否涉嫌違反《金保法》之「適合度原則」與「充分說明義務」**。\n\n根據錄音與文件比對：\n1. 客戶風險屬性評估表防線為「保守型」，但銷售之保單為高風險商品，適合度分析顯有缺失。\n2. 理專在解說過程中，僅口頭強調「每月配息 6%」，並未充分提及淨值波動與匯損可能導致本金虧損。\n\n建議下一步可朝向**「適合度不符與說明不足之比例責任」**進行和解評估。'
  },
  'C-20231102-005': {
    id: 'C-20231102-005',
    applicant: '李○○（34歲）',
    status: '進行中',
    badgeClass: 'badge-progress',
    type: '保險給付爭議 (醫療保險)',
    item: '日間住院實支實付理賠遭拒',
    amount: 'NT$ 84,000',
    created: '2023-11-02',
    updated: '2023-11-03',
    summary: [
      '申請人因憂鬱症於精神科醫院接受「日間住院」治療，共計 28 天，向保險公司申請每日住院醫療保險金。',
      '保險公司拒絕理賠，主張保險契約約定之「住院」定義需為「辦理住院手續且確實在醫院接受治療者」，日間住院並未過夜留宿。',
      '申請人抗辯日間住院亦屬醫師專業診斷所需之實質治療，應予以給付。'
    ],
    laws: [
      {
        title: '保險法第 54-1 條',
        desc: '保險契約之解釋，應探求當事人之真意，不得拘泥於所用之文字；如有疑義時，以作有利於被保險人之解釋為原則。'
      },
      {
        title: '保險法第 131 條',
        desc: '傷害保險人於被保險人遭受意外傷害及其所致殘廢或死亡時，負給付保險金額之責。前項意外傷害，指非由疾病引起之外來突發事故。'
      },
      {
        title: '精神衛生法第 35 條',
        desc: '精神醫療機構提供病人精神醫療服務，包含門診、急診、全日住院、半日住院、日間留院、夜間留院等方式。'
      }
    ],
    initialResponse: '「合規小精靈」分析結果：本案涉及**「日間住院」是否屬於保險合約約定之住院給付範疇**。\n\n1. 保險契約內條文並未明文排除「日間住院」，依據**《保險法》第 54-1 條之疑義利益歸於被保險人原則**，拒賠立場相對薄弱。\n2. 精神科治療實務中，日間留院係屬《精神衛生法》規定之正規精神醫療方式。\n\n建議合規評估意見：**本案保險公司敗訴風險較高，建議予以理賠或進行合理比例之通融給付**。'
  }
};

// Initialize API functions on load
async function initApi() {
  await fetchChatSessions();
  await fetchKnowledgeBase();
  initUploadZone();
}

// Automatically grow prompt input textarea based on user input height
function autoGrow(el) {
  el.style.height = '48px';
  const newHeight = Math.min(el.scrollHeight, 180);
  el.style.height = newHeight + 'px';
}

// Drag & Drop event bindings on load
function initUploadZone() {
  const dropzone = document.getElementById('upload-zone');
  if (!dropzone) return;
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, false);
}

// Handle manual file upload selection
async function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    await handleFile(files[0]);
  }
}

// Handle case file upload and details parsing
async function handleFile(file) {
  appendSystemMessage(`系統偵測到案件檔案上傳：<b>${file.name}</b>。正在將檔案寫入向量知識庫...`);
  
  let uploadSucceeded = false;
  let remoteFilePath = '';
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const uploadRes = await fetch(`${API_BASE}/import/uploads`, {
      method: 'POST',
      body: formData
    });
    
    if (uploadRes.ok) {
      const resData = await uploadRes.json();
      remoteFilePath = resData.path || resData.file_path || '';
      uploadSucceeded = true;
      appendSystemMessage(`雲端上傳成功，正啟動 RAG 向量知識庫切片流程...`);
      
      await fetch(`${API_BASE}/import/vector/knowledge`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: file.name,
          file_name: file.name,
          file_path: remoteFilePath
        })
      });
      
      await fetchKnowledgeBase();
    }
  } catch (err) {
    console.warn('API upload error, using local fallback parser:', err);
  }

  // Fallback local case generation based on file name details
  const caseId = 'C-UPL-' + Math.floor(Math.random() * 90000 + 10000);
  let applicantName = '陳○○';
  let disputeItem = '理賠範圍爭議與說明義務瑕疵';
  let disputeType = '金融消費爭議 (一般商品)';
  
  const cleanName = file.name.replace(/\.[^/.]+$/, ""); 
  const parts = cleanName.split('_');
  if (parts.length >= 2) {
    applicantName = parts[0];
    disputeItem = parts[1];
  } else if (cleanName.includes('張')) {
    applicantName = '張○○';
  } else if (cleanName.includes('李')) {
    applicantName = '李○○';
  } else if (cleanName.includes('王')) {
    applicantName = '王○○';
  }
  
  if (cleanName.includes('住院') || cleanName.includes('保險') || cleanName.includes('醫療')) {
    disputeType = '保險給付爭議 (醫療保險)';
  } else if (cleanName.includes('理專') || cleanName.includes('投資') || cleanName.includes('基金')) {
    disputeType = '金融消費爭議 (投資型商品)';
  }

  caseDb[caseId] = {
    id: caseId,
    applicant: applicantName,
    status: '審查中',
    badgeClass: 'badge-review',
    type: disputeType,
    item: disputeItem,
    amount: 'NT$ 120,000 (預估)',
    created: new Date().toISOString().split('T')[0],
    updated: new Date().toISOString().split('T')[0],
    summary: [
      `本案為使用者透過文件 [${file.name}] 即時上傳建立。`,
      `系統已解析檔案，偵測關係人為 [${applicantName}]，涉案核心要點為 [${disputeItem}]。`,
      `已為本檔案建立對應之雲端協作 RAG Chat 對話工作區。`
    ],
    laws: [
      {
        title: '金融消費者保護法第 10 條',
        desc: '金融服務業應向金融消費者充分說明金融商品之重要內容及風險，並進行風險揭露。'
      },
      {
        title: '保險法第 54-1 條',
        desc: '保險契約如有疑義時，以作有利於被保險人之解釋為原則。'
      }
    ],
    initialResponse: `「合規小精靈」已針對您上傳的自訂案件 **${file.name}** (案號 ${caseId}) 完成向量解構。\n\n根據上傳卷宗，涉案當事人 **${applicantName}** 主張其受有合規損害（爭議項目：${disputeItem}）。\n\n建議您可以直接在下方詢問此案的合規瑕疵細節，或要求生成答辯意見書草稿。`
  };

  document.getElementById('case-search').value = caseId;
  await triggerSearch();
}

// Create custom case from manual input form
async function createCustomCaseFromForm() {
  const applicant = document.getElementById('form-applicant').value.trim() || '自訂申請人';
  const type = document.getElementById('form-type').value;
  const item = document.getElementById('form-item').value.trim() || '未填寫爭議要點';
  const amount = document.getElementById('form-amount').value.trim() || 'NT$ 0';

  const caseId = 'C-NEW-' + Math.floor(Math.random() * 90000 + 10000);
  
  caseDb[caseId] = {
    id: caseId,
    applicant: applicant,
    status: '進行中',
    badgeClass: 'badge-progress',
    type: type,
    item: item,
    amount: amount,
    created: new Date().toISOString().split('T')[0],
    updated: new Date().toISOString().split('T')[0],
    summary: [
      `本案件由合規專員於系統上手動輸入建立。`,
      `關係當事人：${applicant}。`,
      `主要爭議標的與要點：${item}，涉案總金額：${amount}。`
    ],
    laws: [
      {
        title: '金融消費者保護法第 9 條',
        desc: '金融服務業與金融消費者訂立契約前，應充分瞭解金融消費者之適合度。'
      }
    ],
    initialResponse: `「合規小精靈」已建立手動輸入案件 **${caseId}**。\n\n關係當事人：${applicant}\n爭議項目：${item}\n\n已連結雲端 RAG 後端，您現在可以直接詢問與此自訂案件相關的金融合規分析。`
  };

  document.getElementById('case-search').value = caseId;
  await triggerSearch();
}

// Reset workspace to uploader empty state
function resetWorkspace() {
  activeCaseId = null;
  activeChatId = null;
  document.getElementById('case-search').value = '';
  
  document.getElementById('sidebar-empty').style.display = 'flex';
  document.getElementById('sidebar-card').style.display = 'none';
  
  document.getElementById('chat-empty').style.display = 'flex';
  document.getElementById('chat-container').style.display = 'none';
  document.getElementById('chat-container').innerHTML = '';
  
  document.getElementById('form-applicant').value = '';
  document.getElementById('form-item').value = '';
  document.getElementById('form-amount').value = '';
  renderLawsSidebar(null);
}

// Fetch chat sessions list
async function fetchChatSessions() {
  try {
    const res = await fetch(`${API_BASE}/chat/list`, {
      headers: getHeaders()
    });
    if (res.ok) {
      chatList = await res.json();
    }
  } catch (err) {
    console.error('Error fetching chat sessions:', err);
  }
}

// Fetch Knowledge Base files and render in panel
async function fetchKnowledgeBase() {
  try {
    const res = await fetch(`${API_BASE}/import/vector/knowledge`, {
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.knowledge) {
        vectorKnowledgeFiles = data.knowledge;
        renderLawsSidebar(caseDb[activeCaseId]);
      }
    }
  } catch (err) {
    console.error('Error loading knowledge files:', err);
  }
}

function renderLawsSidebar(matchedCase) {
  const container = document.getElementById('sidebar-laws-list');
  if (!container) return;
  container.innerHTML = '';

  // 1. Render Case-Specific Laws first (if case is loaded)
  if (matchedCase && matchedCase.laws && matchedCase.laws.length > 0) {
    const titleEl = document.createElement('div');
    titleEl.style.fontSize = '0.72rem';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.color = 'var(--accent-gold-dark)';
    titleEl.style.margin = '0.5rem 0';
    titleEl.textContent = '📌 案卷建議法規';
    container.appendChild(titleEl);

    matchedCase.laws.forEach(law => {
      const item = document.createElement('div');
      item.className = 'law-item';
      item.onclick = () => insertCitation(law.title);
      item.innerHTML = `
        <div class="law-title">
          <span>⚖️ ${law.title}</span>
          <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="12" height="12">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
        <div class="law-desc">${law.desc}</div>
      `;
      container.appendChild(item);
    });
  }

  // 2. Render Cloud Vector Knowledge Base files
  if (vectorKnowledgeFiles && vectorKnowledgeFiles.length > 0) {
    const titleEl = document.createElement('div');
    titleEl.style.fontSize = '0.72rem';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.color = 'var(--accent-blue)';
    titleEl.style.margin = '0.75rem 0 0.5rem 0';
    titleEl.textContent = '📚 雲端知識庫文檔 (RAG)';
    container.appendChild(titleEl);

    vectorKnowledgeFiles.forEach(k => {
      const item = document.createElement('div');
      item.className = 'law-item';
      const cleanTitle = k.title || k.file_name;
      const shortName = k.file_name.replace('.pdf', '');
      item.onclick = () => insertCitation(shortName);
      item.innerHTML = `
        <div class="law-title">
          <span>⚖️ ${cleanTitle}</span>
          <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="12" height="12">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
        <div class="law-desc">${k.summary || '點選以引用此法規條文。'}</div>
      `;
      container.appendChild(item);
    });
  }

  if (container.children.length === 0) {
    container.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); padding:0.5rem 0;">尚未載入法規文檔</div>';
  }
}

// Load messages history for a chat
async function loadChatMessages(chatId) {
  try {
    const res = await fetch(`${API_BASE}/chat/${chatId}/messages`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Load messages failed');
    
    const messages = await res.json();
    const chatContainer = document.getElementById('chat-container');
    chatContainer.innerHTML = '';
    
    appendSystemMessage(`已同步雲端 API 會話紀錄。`);

    if (messages && messages.length > 0) {
      messages.forEach(msg => {
        const role = msg.role || msg.speaker;
        const text = msg.text || msg.content || '';
        if (role === 'user') {
          appendUserMessage(text);
        } else if (text) {
          const stream = document.getElementById('chat-container');
          const row = document.createElement('div');
          row.className = 'message-row assistant';
          row.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-bubble">${formatMessageText(text)}</div>
          `;
          stream.appendChild(row);
          scrollChatToBottom();
        }
      });
    } else {
      const matchedCase = caseDb[activeCaseId];
      if (matchedCase) {
        simulateAiResponse(matchedCase.initialResponse);
      }
    }
  } catch (err) {
    console.error('Error loading historical messages:', err);
    const matchedCase = caseDb[activeCaseId];
    if (matchedCase) {
      simulateAiResponse(matchedCase.initialResponse);
    }
  }
}

// Create a new chat session
async function createChatSession(caseId, initialPrompt) {
  try {
    const createRes = await fetch(`${API_BASE}/chat/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({})
    });
    if (!createRes.ok) throw new Error('Create session failed');
    const createData = await createRes.json();
    const chatId = createData.insertedId;
    activeChatId = chatId;

    await fetch(`${API_BASE}/chat/${chatId}/update`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title: caseId })
    });

    await fetchChatSessions();
    appendSystemMessage(`已建立雲端 RAG 協作專案。`);
    
    setTimeout(() => {
      simulateAiResponse(initialPrompt);
    }, 600);
  } catch (err) {
    console.error('Error creating live chat:', err);
    activeChatId = 'mock_chat_' + caseId;
    appendSystemMessage(`連線 API 異常，已啟動本地模擬工作區。`);
    setTimeout(() => {
      simulateAiResponse(initialPrompt);
    }, 600);
  }
}

function formatMessageText(text) {
  if (!text) return '';
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/^### (.*?)$/gm, '<h4 style="margin: 0.5rem 0 0.2rem 0; color: var(--accent-gold-dark);">$1</h4>');
  text = text.replace(/^## (.*?)$/gm, '<h3 style="margin: 0.75rem 0 0.3rem 0; color: var(--accent-blue);">$1</h3>');
  text = text.split('\n').map(line => {
    if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ') || line.startsWith('4. ')) {
      return `<div style="margin-left: 0.8rem; margin-top: 0.2rem;">${line}</div>`;
    }
    if (line.trim().startsWith('* ')) {
      return `<div style="margin-left: 0.8rem; margin-top: 0.2rem; display: flex; gap: 0.35rem;"><span style="color: var(--accent-gold);">•</span><span>${line.trim().substring(2)}</span></div>`;
    }
    return line;
  }).join('\n');
  return text.replace(/\n/g, '<br>');
}

function setSearch(caseId) {
  document.getElementById('case-search').value = caseId;
  triggerSearch();
}

async function triggerSearch() {
  const q = document.getElementById('case-search').value.trim();
  if (!q) return;
  const matchedCase = caseDb[q];

  if (matchedCase) {
    activeCaseId = q;
    document.getElementById('sidebar-empty').style.display = 'none';
    const card = document.getElementById('sidebar-card');
    card.style.display = 'block';

    document.getElementById('case-id').textContent = matchedCase.id;
    document.getElementById('case-applicant').textContent = matchedCase.applicant;
    document.getElementById('case-type').textContent = matchedCase.type;
    document.getElementById('case-item').textContent = matchedCase.item;
    document.getElementById('case-amount').textContent = matchedCase.amount;
    document.getElementById('case-created').textContent = matchedCase.created;
    document.getElementById('case-updated').textContent = matchedCase.updated;

    const statusBadge = document.getElementById('case-badge-status');
    statusBadge.textContent = matchedCase.status;
    statusBadge.className = 'case-badge ' + matchedCase.badgeClass;

    renderLawsSidebar(matchedCase);

    const summaryContainer = document.getElementById('sidebar-summary-list');
    summaryContainer.innerHTML = '';
    matchedCase.summary.forEach(point => {
      const bullet = document.createElement('div');
      bullet.className = 'summary-bullet';
      bullet.innerHTML = `<span class="summary-text">${point}</span>`;
      summaryContainer.appendChild(bullet);
    });

    document.getElementById('chat-empty').style.display = 'none';
    const chatContainer = document.getElementById('chat-container');
    chatContainer.style.display = 'flex';
    chatContainer.innerHTML = ''; 
    appendSystemMessage(`已載入案件 ${matchedCase.id}。AI 分析工作區準備就緒。`);

    let existingChat = chatList.find(c => c.title === matchedCase.id);
    if (existingChat) {
      activeChatId = existingChat._id;
      await loadChatMessages(activeChatId);
    } else {
      await createChatSession(matchedCase.id, matchedCase.initialResponse);
    }
  } else {
    alert('無此測試案件，請輸入 C-20231015-001 或 C-20231102-005 進行試用。');
  }
}

function toggleSection(id, headerEl) {
  const el = document.getElementById(id);
  if (el.style.display === 'none' || el.style.maxHeight === '0px') {
    el.style.display = 'flex';
    el.style.maxHeight = '500px';
    headerEl.classList.remove('collapsed');
  } else {
    el.style.maxHeight = '0px';
    setTimeout(() => { el.style.display = 'none'; }, 300);
    headerEl.classList.add('collapsed');
  }
}

function appendSystemMessage(text) {
  const stream = document.getElementById('chat-container');
  const row = document.createElement('div');
  row.className = 'message-row system';
  row.innerHTML = `<div class="message-bubble">${text}</div>`;
  stream.appendChild(row);
  scrollChatToBottom();
}

function appendUserMessage(text) {
  const stream = document.getElementById('chat-container');
  const row = document.createElement('div');
  row.className = 'message-row user';
  row.innerHTML = `
    <div class="message-avatar">用</div>
    <div class="message-bubble">${formatMessageText(text)}</div>
  `;
  stream.appendChild(row);
  scrollChatToBottom();
}

// typing effect
function simulateAiResponse(responseText) {
  const stream = document.getElementById('chat-container');
  const row = document.createElement('div');
  row.className = 'message-row assistant';
  row.innerHTML = `
    <div class="message-avatar">AI</div>
    <div class="message-bubble" id="typing-bubble">
      <div class="typing-loader"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>
    </div>
  `;
  stream.appendChild(row);
  scrollChatToBottom();

  setTimeout(() => {
    const bubble = document.getElementById('typing-bubble');
    if (bubble) {
      bubble.removeAttribute('id');
      bubble.innerHTML = '';
      let index = 0;
      const speed = 15;
      function typeWriter() {
        if (index < responseText.length) {
          const sliceSize = responseText.substr(index, 3);
          bubble.innerHTML += sliceSize;
          index += 3;
          bubble.innerHTML = formatMessageText(bubble.innerText);
          scrollChatToBottom();
          setTimeout(typeWriter, speed);
        }
      }
      typeWriter();
    }
  }, 800);
}

function insertCitation(lawTitle) {
  const promptInput = document.getElementById('prompt-input');
  promptInput.value = `請幫我分析本案中，是否有與 ${lawTitle} 相關的合規疑慮或前例？ `;
  promptInput.focus();
}

function useQuickPrompt(promptText) {
  document.getElementById('prompt-input').value = promptText;
  handleSendText();
}

async function askAiToAnalyzeCase() {
  if (!activeCaseId) return;
  appendUserMessage('啟動對此案的深入適法性評估分析。');
  
  const promptText = '請針對本案細節，啟動深入的適法性評估與合規風險分析。';
  
  if (!activeChatId || activeChatId.startsWith('mock_chat_')) {
    setTimeout(() => {
      simulateAiResponse('正在調取關聯案件司法判決書與金評會裁決書...\n\n經查，本件爭議涉及銷售投資型商品。金評會類似裁決（如 110 年評字第 124 號）指出，業者若無法舉證其於業務員推介時已詳實揭露主要投資風險及匯率折算要點，即應認定未盡金保法第 10 條之說明義務。\n\n本案評估意見：**業者合規瑕疵明確度高，建議先行向消費者協議 30%~50% 金額之補償和解。**');
    }, 600);
    return;
  }

  await sendQuestionToApi(promptText);
}

// Send input logic
async function handleSendText() {
  const promptInput = document.getElementById('prompt-input');
  const text = promptInput.value.trim();
  if (!text) return;

  if (!activeCaseId) {
    // Bootstrap a text-based custom case dynamically
    const bootText = text;
    const caseId = 'C-TXT-' + Math.floor(Math.random() * 90000 + 10000);
    
    let disputeType = '金融消費爭議 (一般商品)';
    if (bootText.includes('住院') || bootText.includes('醫療') || bootText.includes('保險')) {
      disputeType = '保險給付爭議 (醫療險)';
    } else if (bootText.includes('理專') || bootText.includes('基金') || bootText.includes('投資')) {
      disputeType = '金融消費爭議 (投資型商品)';
    }

    const guessedItem = bootText.length > 25 ? bootText.substring(0, 25) + '...' : bootText;

    caseDb[caseId] = {
      id: caseId,
      applicant: '文字自訂當事人',
      status: '分析中',
      badgeClass: 'badge-progress',
      type: disputeType,
      item: guessedItem,
      amount: '依案文而定',
      created: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString().split('T')[0],
      summary: [
        `由合規專員於對話框中直接輸入文字案情建立。`,
        `輸入原始敘述："${bootText.substring(0, 60)}..."`
      ],
      laws: [
        {
          title: '金融消費者保護法第 9 條',
          desc: '金融服務業與金融消費者訂立契約前，應充分瞭解金融消費者，以確保商品適合度。'
        }
      ],
      initialResponse: '「合規小精靈」已接收到您的文字案例，已自動建立新會話，正在為您送出合規分析...'
    };

    // Clear search field, prompt field and load case
    document.getElementById('case-search').value = caseId;
    promptInput.value = '';
    promptInput.style.height = '48px';
    
    await triggerSearch(); // this triggers chat creation and loads it
    
    // Wait briefly for triggerSearch to create session then send question
    setTimeout(async () => {
      appendUserMessage(bootText);
      await sendQuestionToApi(bootText);
    }, 1200);
    
    return;
  }

  appendUserMessage(text);
  promptInput.value = '';
  promptInput.style.height = '48px';

  if (!activeChatId || activeChatId.startsWith('mock_chat_')) {
    let mockReply = '已收到您的問題。正在檢索本案卷宗與法學知識庫...\n\n針對您的提問「' + text + '」，合規精靈建議：\n\n1. 應重新調閱專員與客戶的通聯記錄或臨櫃錄影。\n2. 對照同類型商品爭議之金評會判定，我方應在答辯書中強調客戶已簽署之風險預告書條款，但需防範法官引用《金保法》適合度漏洞。';
    if (text.includes('報告') || text.includes('報告草稿')) {
      mockReply = '## 金融消費爭議案件合規審查意見書 (草稿)\n\n*   **案號**：' + activeCaseId + '\n*   **審查重點**：' + caseDb[activeCaseId].item + '\n\n### ⚖️ 合規性判定\n根據現有事證，本案評估有顯著合規疏失風險，主要集中於適合度規範之落實與風險揭露聲明是否被口頭承諾所架空。\n\n### 💡 行動方案指引\n1. **協議和解**：爭取於評議程序前取得和解。\n2. **合規宣導**：加強前線理專之風險告知抽查比率。';
    }
    setTimeout(() => {
      simulateAiResponse(mockReply);
    }, 700);
    return;
  }

  await sendQuestionToApi(text);
}

// API Post implementation helper
async function sendQuestionToApi(questionText) {
  const stream = document.getElementById('chat-container');
  
  // Add temporary typing loader row
  const loaderRow = document.createElement('div');
  loaderRow.className = 'message-row assistant';
  loaderRow.innerHTML = `
    <div class="message-avatar">AI</div>
    <div class="message-bubble" id="typing-bubble">
      <div class="typing-loader">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  stream.appendChild(loaderRow);
  scrollChatToBottom();

  try {
    const response = await fetch(`${API_BASE}/chat/${activeChatId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ question: questionText })
    });

    // Remove loader bubble
    const loader = document.getElementById('typing-bubble');
    if (loader) {
      loader.parentElement.remove();
    }

    if (!response.ok) throw new Error('API Error: ' + response.status);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      // SSE Stream reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      const newRow = document.createElement('div');
      newRow.className = 'message-row assistant';
      newRow.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-bubble" id="streaming-bubble"></div>
      `;
      stream.appendChild(newRow);
      scrollChatToBottom();
      const bubble = document.getElementById('streaming-bubble');
      bubble.removeAttribute('id');

      let fullText = '';
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          const lines = chunk.split('\n');
          for (let line of lines) {
            line = line.trim();
            if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                const word = parsed.choices?.[0]?.delta?.content || parsed.text || parsed.answer || parsed.content || '';
                fullText += word;
                bubble.innerHTML = formatMessageText(fullText);
                scrollChatToBottom();
              } catch (e) {
                if (dataStr) {
                  fullText += dataStr;
                  bubble.innerHTML = formatMessageText(fullText);
                  scrollChatToBottom();
                }
              }
            }
          }
        }
      }
    } else {
      // Regular JSON payload
      const resJson = await response.json();
      const reply = resJson.answer || resJson.reply || resJson.content || resJson.response || resJson.text || JSON.stringify(resJson);
      simulateAiResponse(reply);
    }
  } catch (err) {
    console.error('Live API Query failed:', err);
    const loader = document.getElementById('typing-bubble');
    if (loader) {
      loader.parentElement.remove();
    }
    
    // Notify fallback and run local mock reply
    appendSystemMessage(`API 連線逾時，自動切換至本地專家大模型模擬解答。`);
    let mockReply = '已收到您的問題。正在檢索本案卷宗與法學知識庫...\n\n針對您的提問「' + questionText + '」，合規精靈建議：\n\n1. 應重新調閱專員與客戶的通聯記錄或臨櫃錄影。\n2. 對照同類型商品爭議之金評會判定，我方應在答辯書中強調客戶已簽署之風險預告書條款，但需防範法官引用《金保法》適合度漏洞。';
    if (questionText.includes('報告') || questionText.includes('報告草稿')) {
      mockReply = '## 金融消費爭議案件合規審查意見書 (草稿)\n\n*   **案號**：' + activeCaseId + '\n*   **審查重點**：' + caseDb[activeCaseId].item + '\n\n### ⚖️ 合規性判定\n根據現有事證，本案評估有顯著合規疏失風險，主要集中於適合度規範之落實與風險揭露聲明是否被口頭承諾所架空。\n\n### 💡 行動方案指引\n1. **協議和解**：爭取於評議程序前取得和解。\n2. **合規宣導**：加強前線理專之風險告知抽查比率。';
    }
    setTimeout(() => {
      simulateAiResponse(mockReply);
    }, 600);
  }
}

function checkSubmit(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendText();
  }
}

// Trigger PDF Export simulation
function triggerExport() {
  if (!activeCaseId) {
    alert('請先載入案件。');
    return;
  }
  const toast = document.getElementById('toast-notify');
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
    
    // Export file simulated
    const matchedCase = caseDb[activeCaseId];
    const exportData = {
      exportType: 'Compliance Analysis Report',
      caseId: matchedCase.id,
      applicant: matchedCase.applicant,
      type: matchedCase.type,
      summaryPoints: matchedCase.summary,
      lawsCited: matchedCase.laws.map(l => l.title),
      generatedAt: new Date().toLocaleString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Compliance_Report_${matchedCase.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, 1500);
}

function scrollChatToBottom() {
  const scroller = document.getElementById('chat-scroller');
  if (scroller) {
    scroller.scrollTop = scroller.scrollHeight;
  }
}

// Initialize UI and API variables
window.onload = initApi;
