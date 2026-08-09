(function() {
    'use strict';

    // ========== 版本号 ==========
    // const VERSION = 'v2.3.5';
    // console.log('🚀 刷题器版本:', VERSION);

    // ---------- 版本检查 ----------
    // const STORAGE_VERSION_KEY = 'studyAppVersion';
    // const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    // if (storedVersion && storedVersion !== VERSION) {
    //     alert(`检测到新版本 (${VERSION})，请点击“确定”刷新页面以应用更新。`);
    //     localStorage.setItem(STORAGE_VERSION_KEY, VERSION);
    // } else if (!storedVersion) {
    //     localStorage.setItem(STORAGE_VERSION_KEY, VERSION);
    // }

    // ---------- DOM 引用 ----------
    const uploadScreen = document.getElementById('uploadScreen');
    const mainApp = document.getElementById('mainApp');
    const fileInput = document.getElementById('fileInput');
    const librarySelect = document.getElementById('librarySelect');
    const deleteLibraryBtn = document.getElementById('deleteLibraryBtn');
    const addLibraryBtn = document.getElementById('addLibraryBtn');
    const categoryFilter = document.getElementById('categoryFilter');
    const statusFilter = document.getElementById('statusFilter');
    const modeSelect = document.getElementById('modeSelect');
    const shuffleBtn = document.getElementById('shuffleBtn');
    const cardContent = document.getElementById('cardContent');
    const cardWrapper = document.getElementById('cardWrapper');
    const cardActions = document.getElementById('cardActions');
    const actionMaster = document.getElementById('actionMaster');
    const actionReview = document.getElementById('actionReview');
    const actionReset = document.getElementById('actionReset');
    const helpBtn = document.getElementById('helpBtn');
    const exportBtn = document.getElementById('exportBtn');
    const copyBtn = document.getElementById('copyBtn');
    const pasteImportBtn = document.getElementById('pasteImportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFileInput = document.getElementById('importFileInput');
    const resetAllBtn = document.getElementById('resetAllBtn');
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    const pasteLibraryBtn = document.getElementById('pasteLibraryBtn');
    const exportLibraryBtn = document.getElementById('exportLibraryBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const progressRing = document.getElementById('progressRing');
    const ringPercent = document.getElementById('ringPercent');
    const masteredCount = document.getElementById('masteredCount');
    const reviewCount = document.getElementById('reviewCount');
    const categoryBadge = document.getElementById('categoryBadge');
    const questionId = document.getElementById('questionId');
    const statusTag = document.getElementById('statusTag');

    // ---------- 状态 ----------
    let allLibraries = {};
    let currentLibraryId = null;
    let currentQuestions = [];
    let filteredQuestions = [];
    let currentIndex = 0;
    let isMnemonicVisible = false;
    let isAnswerVisible = false;
    let isRemarkVisible = false;
    let currentMode = 'sequential';
    let currentCategory = 'all';
    let currentStatusFilter = 'all';

    const LIBRARY_LIST_KEY = 'studyLibraries_v4';
    const PROGRESS_KEY = 'studyProgress_v4';

    // ---------- 存储操作 ----------
    function loadLibraries() {
        try {
            const raw = localStorage.getItem(LIBRARY_LIST_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return {};
    }
    function saveLibraries(libs) {
        localStorage.setItem(LIBRARY_LIST_KEY, JSON.stringify(libs));
    }
    function loadProgress() {
        try {
            const raw = localStorage.getItem(PROGRESS_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return {};
    }
    function saveProgress(progress) {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    }
    function getLibraryProgress(libId) {
        const all = loadProgress();
        return all[libId] || {};
    }
    function setLibraryProgress(libId, progress) {
        const all = loadProgress();
        all[libId] = progress;
        saveProgress(all);
    }
    function getQuestionStatus(libId, qId) {
        const prog = getLibraryProgress(libId);
        return prog[qId] || 'none';
    }
    function setQuestionStatus(libId, qId, status) {
        const prog = getLibraryProgress(libId);
        if (status === 'none') delete prog[qId];
        else prog[qId] = status;
        setLibraryProgress(libId, prog);
        updateStatsAndUI();
        renderCard();
    }
    function resetAllProgressForLibrary(libId) {
        if (confirm(`确定要重置题库“${allLibraries[libId].name}”的所有进度吗？`)) {
            setLibraryProgress(libId, {});
            currentIndex = 0;
            isMnemonicVisible = false;
            isAnswerVisible = false;
            isRemarkVisible = false;
            updateStatsAndUI();
            renderCard();
        }
    }

    // ---------- 统计 ----------
    function calcStatsForLibrary(libId) {
        const questions = allLibraries[libId]?.questions || [];
        const total = questions.length;
        const prog = getLibraryProgress(libId);
        let mastered = 0,
            review = 0;
        questions.forEach(q => {
            const s = prog[q.id] || 'none';
            if (s === 'mastered') mastered++;
            else if (s === 'review') review++;
        });
        const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
        return { total, mastered, review, pct };
    }
    function updateStatsAndUI() {
        if (!currentLibraryId || !allLibraries[currentLibraryId]) {
            masteredCount.textContent = '0';
            reviewCount.textContent = '0';
            ringPercent.textContent = '0%';
            progressRing.style.strokeDashoffset = 125.6;
            return;
        }
        const stats = calcStatsForLibrary(currentLibraryId);
        masteredCount.textContent = stats.mastered;
        reviewCount.textContent = stats.review;
        const circumference = 125.6;
        const offset = circumference - (stats.pct / 100) * circumference;
        progressRing.style.strokeDashoffset = offset;
        ringPercent.textContent = stats.pct + '%';
        if (stats.pct >= 80) progressRing.style.stroke = '#16a34a';
        else if (stats.pct >= 40) progressRing.style.stroke = '#eab308';
        else progressRing.style.stroke = '#4f46e5';
    }

    // ---------- 辅助函数 ----------
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ---------- 编辑答案/备注的模态框 ----------
    function showEditModal(title, currentValue, onSave) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>${title}</h3>
                <textarea id="editTextarea" rows="6" placeholder="输入内容...">${escapeHtml(currentValue)}</textarea>
                <div class="modal-actions">
                    <button class="btn-secondary" id="editCancelBtn">取消</button>
                    <button class="btn-primary" id="editSaveBtn">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.querySelector('#editCancelBtn').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        overlay.querySelector('#editSaveBtn').addEventListener('click', () => {
            const val = overlay.querySelector('#editTextarea').value;
            onSave(val);
            close();
        });
        overlay.querySelector('#editTextarea').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                const val = overlay.querySelector('#editTextarea').value;
                onSave(val);
                close();
            }
        });
    }

    // ---------- 目录弹窗 ----------
    function showCatalog() {
        if (!filteredQuestions.length) {
            alert('当前没有题目');
            return;
        }
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        let listHtml = '';
        // 判断当前分类是否为“全部”
        const isAllCategory = categoryFilter.value === 'all';
        filteredQuestions.forEach((q, idx) => {
            const status = getQuestionStatus(currentLibraryId, q.id);
            const statusClass = status === 'mastered' ? 'status-mastered' :
                status === 'review' ? 'status-review' : 'status-none';
            const statusLabel = status === 'mastered' ? '✅' :
                status === 'review' ? '🔄' : '⏳';
            // 显示ID：全部分类用全局ID，具体分类用displayId
            const displayId = isAllCategory ? q.id : (q.displayId || q.id);
            const shortTitle = q.question.length > 30 ? q.question.slice(0, 30) + '…' : q.question;
            listHtml += `
                <div class="catalog-item ${statusClass}" data-index="${idx}">
                    <span class="index">#${displayId}</span>
                    <span class="title">${escapeHtml(shortTitle)}</span>
                    <span class="status-badge">${statusLabel}</span>
                </div>
            `;
        });
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>
                    📋 目录 (${filteredQuestions.length}题)
                    <button class="close-btn" id="catalogCloseBtn">✕</button>
                </h3>
                <div class="catalog-list">
                    ${listHtml}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#catalogCloseBtn').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        overlay.querySelectorAll('.catalog-item').forEach(item => {
            item.addEventListener('click', function() {
                const idx = parseInt(this.dataset.index);
                if (!isNaN(idx) && idx >= 0 && idx < filteredQuestions.length) {
                    currentIndex = idx;
                    isMnemonicVisible = false;
                    isAnswerVisible = false;
                    isRemarkVisible = false;
                    if (currentMode === 'random') {
                        currentMode = 'sequential';
                        modeSelect.value = 'sequential';
                    }
                    renderCard();
                    overlay.remove();
                }
            });
        });
    }

    // ---------- 保存当前题目的答案或备注 ----------
    function saveQuestionField(field, value) {
        if (!currentLibraryId || !filteredQuestions.length) return;
        const q = filteredQuestions[currentIndex];
        if (!q) return;
        const lib = allLibraries[currentLibraryId];
        const question = lib.questions.find(item => item.id === q.id);
        if (!question) return;
        question[field] = value;
        saveLibraries(allLibraries);
        renderCard();
    }

    // ---------- 渲染卡片 ----------
    function renderCard() {
        if (!currentLibraryId || !allLibraries[currentLibraryId]) {
            cardContent.innerHTML = `<div class="empty-state">请先上传或选择一个题库</div>`;
            cardWrapper.className = 'card-wrapper';
            cardActions.innerHTML = '';
            updateStatsAndUI();
            return;
        }
        const questions = currentQuestions;
        if (!questions.length) {
            cardContent.innerHTML = `<div class="empty-state">当前题库为空</div>`;
            cardWrapper.className = 'card-wrapper';
            cardActions.innerHTML = '';
            updateStatsAndUI();
            return;
        }
        if (!filteredQuestions.length) {
            cardContent.innerHTML = `<div class="empty-state">当前筛选无题目</div>`;
            cardWrapper.className = 'card-wrapper';
            cardActions.innerHTML = '';
            updateStatsAndUI();
            return;
        }
        if (currentIndex >= filteredQuestions.length) currentIndex = filteredQuestions.length - 1;
        if (currentIndex < 0) currentIndex = 0;

        const q = filteredQuestions[currentIndex];
        if (!q) { cardContent.innerHTML = `<div class="empty-state">加载失败</div>`; return; }

        const status = getQuestionStatus(currentLibraryId, q.id);
        cardWrapper.className = 'card-wrapper';
        if (status === 'mastered') cardWrapper.classList.add('mastered');
        else if (status === 'review') cardWrapper.classList.add('review');

        const displayId = q.displayId || q.id;
        questionId.textContent = displayId;
        categoryBadge.textContent = (q.category || '未分类') + ' #' + displayId;
        
        statusTag.className = 'status-tag ' + status;
        statusTag.textContent = status === 'mastered' ? '✅ 已掌握' : status === 'review' ? '🔄 待复习' : '⏳ 未开始';

        const type = q.type || 'essay';
        let html = `<div class="card-question">${escapeHtml(q.question)}</div>`;

        // ======== 选择题渲染（不变） ========
        if (type === 'single') {
            const options = q.options || [];
            const correctAnswer = q.answer ? q.answer.trim().toUpperCase() : '';
            html += `<div class="options-container" id="optionsContainer">`;
            options.forEach((opt, idx) => {
                const label = String.fromCharCode(65 + idx);
                const isCorrect = (label === correctAnswer);
                html += `
                    <div class="option-item" data-label="${label}" data-correct="${isCorrect}">
                        <span class="option-label">${label}.</span>
                        <span class="option-text">${escapeHtml(opt)}</span>
                    </div>
                `;
            });
            html += `</div>`;
            html += `<div class="feedback" id="feedback"></div>`;
        } else if (type === 'multi') {
            const options = q.options || [];
            const correctAnswers = q.answer ? q.answer.split(/[,，\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean) : [];
            html += `<div class="options-container" id="optionsContainer">`;
            options.forEach((opt, idx) => {
                const label = String.fromCharCode(65 + idx);
                html += `
                    <div class="option-item" data-label="${label}">
                        <span class="option-label">${label}.</span>
                        <span class="option-text">${escapeHtml(opt)}</span>
                    </div>
                `;
            });
            html += `</div>`;
            html += `<button class="multi-confirm" id="multiConfirm">确认答案</button>`;
            html += `<div class="feedback" id="feedback"></div>`;
        } else if (type === 'judge') {
            const correctAnswer = q.answer ? q.answer.trim() : '';
            html += `<div class="judge-buttons" id="judgeButtons">`;
            html += `<button data-value="对" class="judge-btn">✅ 对</button>`;
            html += `<button data-value="错" class="judge-btn">❌ 错</button>`;
            html += `</div>`;
            html += `<div class="feedback" id="feedback"></div>`;
        } else if (type === 'fill') {
            const correctAnswer = q.answer ? q.answer.trim() : '';
            html += `<div class="fill-group" id="fillGroup">`;
            html += `<input type="text" id="fillInput" placeholder="输入答案...">`;
            html += `<button id="fillConfirm">确认答案</button>`;
            html += `</div>`;
            html += `<div class="feedback" id="feedback"></div>`;
        } else {
            // 简答题：显示答案和备注内容（根据可见性）
            const answerText = q.answerText || '';
            const remarks = q.remarks || '';
            if (answerText) {
                html += `<div class="card-answer ${isAnswerVisible ? 'show' : ''}">
                            <div class="label">📝 答案</div>
                            <div class="content">${escapeHtml(answerText)}</div>
                        </div>`;
            }
            if (remarks) {
                html += `<div class="card-remark ${isRemarkVisible ? 'show' : ''}">
                            <div class="label">📌 备注</div>
                            <div class="content">${escapeHtml(remarks)}</div>
                        </div>`;
            }
        }

        // 口诀/解析（对所有题型）
        const explanation = q.explanation || q.mnemonic || '';
        if (explanation) {
            html += `
                <div class="card-mnemonic ${isMnemonicVisible ? 'show' : ''}">
                    <div class="label">📌 ${type === 'essay' ? '口诀' : '解析'}</div>
                    <div class="content">${escapeHtml(explanation)}</div>
                </div>
            `;
        }

        cardContent.innerHTML = html;

        // ======== 绑定选择题交互（不变） ========
        if (type === 'single') {
            const items = cardContent.querySelectorAll('.option-item');
            const feedback = document.getElementById('feedback');
            items.forEach(item => {
                item.addEventListener('click', function() {
                    items.forEach(el => {
                        el.classList.remove('selected', 'correct-answer', 'wrong-answer');
                    });
                    this.classList.add('selected');
                    const isCorrect = this.dataset.correct === 'true';
                    if (isCorrect) {
                        this.classList.add('correct-answer');
                        feedback.className = 'feedback show correct';
                        feedback.innerHTML = '✅ 回答正确！';
                    } else {
                        this.classList.add('wrong-answer');
                        feedback.className = 'feedback show wrong';
                        feedback.innerHTML = '❌ 回答错误。正确答案是：' + (q.answer || '');
                    }
                    const expl = explanation.trim();
                    if (expl && expl !== '（无口诀）') {
                        const explDiv = document.createElement('div');
                        explDiv.className = 'explanation';
                        explDiv.textContent = '📖 解析：' + expl;
                        feedback.appendChild(explDiv);
                    }
                    items.forEach(el => el.style.pointerEvents = 'none');
                });
            });
        } else if (type === 'multi') {
            const items = cardContent.querySelectorAll('.option-item');
            const confirmBtn = document.getElementById('multiConfirm');
            const feedback = document.getElementById('feedback');
            let selectedLabels = [];

            items.forEach(item => {
                item.addEventListener('click', function() {
                    const label = this.dataset.label;
                    this.classList.toggle('selected');
                    if (this.classList.contains('selected')) {
                        if (!selectedLabels.includes(label)) selectedLabels.push(label);
                    } else {
                        selectedLabels = selectedLabels.filter(l => l !== label);
                    }
                    feedback.className = 'feedback';
                    feedback.innerHTML = '';
                    items.forEach(el => {
                        el.classList.remove('correct-answer', 'wrong-answer');
                    });
                    confirmBtn.disabled = false;
                });
            });

            confirmBtn.addEventListener('click', function() {
                if (selectedLabels.length === 0) {
                    alert('请至少选择一个选项');
                    return;
                }
                const correctAnswers = q.answer ? q.answer.split(/[,，\s]+/).map(s => s.trim().toUpperCase())
                    .filter(Boolean) : [];
                let allCorrect = true;
                items.forEach(el => {
                    const label = el.dataset.label;
                    const isCorrect = correctAnswers.includes(label);
                    if (isCorrect) {
                        el.classList.add('correct-answer');
                    } else {
                        el.classList.add('wrong-answer');
                    }
                    const userSelected = selectedLabels.includes(label);
                    if (userSelected && !isCorrect) allCorrect = false;
                    if (!userSelected && isCorrect) allCorrect = false;
                });
                if (allCorrect && selectedLabels.length === correctAnswers.length) {
                    feedback.className = 'feedback show correct';
                    feedback.innerHTML = '✅ 全部正确！';
                } else {
                    feedback.className = 'feedback show wrong';
                    feedback.innerHTML = '❌ 有误，正确答案：' + correctAnswers.join(', ');
                }
                const expl = explanation.trim();
                if (expl && expl !== '（无口诀）') {
                    const explDiv = document.createElement('div');
                    explDiv.className = 'explanation';
                    explDiv.textContent = '📖 解析：' + expl;
                    feedback.appendChild(explDiv);
                }
                confirmBtn.disabled = true;
                items.forEach(el => el.style.pointerEvents = 'none');
            });
        } else if (type === 'judge') {
            const btns = cardContent.querySelectorAll('.judge-btn');
            const feedback = document.getElementById('feedback');
            const correctAnswer = q.answer ? q.answer.trim() : '';
            btns.forEach(btn => {
                btn.addEventListener('click', function() {
                    const value = this.dataset.value;
                    const isCorrect = (value === correctAnswer);
                    btns.forEach(b => {
                        b.classList.remove('selected-true', 'selected-false', 'correct',
                            'wrong');
                        b.disabled = true;
                    });
                    if (isCorrect) {
                        this.classList.add('correct');
                        feedback.className = 'feedback show correct';
                        feedback.innerHTML = '✅ 回答正确！';
                    } else {
                        this.classList.add('wrong');
                        feedback.className = 'feedback show wrong';
                        feedback.innerHTML = '❌ 回答错误。正确答案：' + correctAnswer;
                    }
                    const expl = explanation.trim();
                    if (expl && expl !== '（无口诀）') {
                        const explDiv = document.createElement('div');
                        explDiv.className = 'explanation';
                        explDiv.textContent = '📖 解析：' + expl;
                        feedback.appendChild(explDiv);
                    }
                });
            });
        } else if (type === 'fill') {
            const input = document.getElementById('fillInput');
            const confirmBtn = document.getElementById('fillConfirm');
            const feedback = document.getElementById('feedback');
            const correctAnswer = q.answer ? q.answer.trim() : '';

            confirmBtn.addEventListener('click', function() {
                const userAns = input.value.trim();
                if (!userAns) {
                    alert('请输入答案');
                    return;
                }
                const isCorrect = userAns.toLowerCase() === correctAnswer.toLowerCase();
                if (isCorrect) {
                    feedback.className = 'feedback show correct';
                    feedback.innerHTML = '✅ 回答正确！';
                } else {
                    feedback.className = 'feedback show wrong';
                    feedback.innerHTML = '❌ 回答错误。正确答案：' + correctAnswer;
                }
                const expl = explanation.trim();
                if (expl && expl !== '（无口诀）') {
                    const explDiv = document.createElement('div');
                    explDiv.className = 'explanation';
                    explDiv.textContent = '📖 解析：' + expl;
                    feedback.appendChild(explDiv);
                }
                input.disabled = true;
                confirmBtn.disabled = true;
            });
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                }
            });
        }

        // ======== 重建 card-actions（简答题固定按钮组） ========
        let extraButtons = '';
        if (type === 'essay') {
            // 答案字段状态
            const hasAnswer = q.answerText && q.answerText.trim() !== '';
            const answerAddDisabled = hasAnswer;
            const answerEditDisabled = !hasAnswer;
            const answerDeleteDisabled = !hasAnswer;
            const answerToggleLabel = isAnswerVisible ? '🙈 隐藏答案' : '👁️ 显示答案';

            // 备注字段状态
            const hasRemark = q.remarks && q.remarks.trim() !== '';
            const remarkAddDisabled = hasRemark;
            const remarkEditDisabled = !hasRemark;
            const remarkDeleteDisabled = !hasRemark;
            const remarkToggleLabel = isRemarkVisible ? '🙈 隐藏备注' : '👁️ 显示备注';

            extraButtons = `
                <button class="hint-btn" id="addAnswerBtn" ${answerAddDisabled ? 'disabled' : ''}>➕ 添加答案</button>
                <button class="hint-btn" id="editAnswerBtn" ${answerEditDisabled ? 'disabled' : ''}>✏️ 修改答案</button>
                <button class="hint-btn ${isAnswerVisible ? 'showing' : ''}" id="toggleAnswerBtn">${answerToggleLabel}</button>
                <button class="hint-btn" id="deleteAnswerBtn" ${answerDeleteDisabled ? 'disabled' : ''}>🗑️ 删除答案</button>
                <button class="hint-btn" id="addRemarkBtn" ${remarkAddDisabled ? 'disabled' : ''}>➕ 添加备注</button>
                <button class="hint-btn" id="editRemarkBtn" ${remarkEditDisabled ? 'disabled' : ''}>✏️ 修改备注</button>
                <button class="hint-btn ${isRemarkVisible ? 'showing' : ''}" id="toggleRemarkBtn">${remarkToggleLabel}</button>
                <button class="hint-btn" id="deleteRemarkBtn" ${remarkDeleteDisabled ? 'disabled' : ''}>🗑️ 删除备注</button>
            `;
        }
        cardActions.innerHTML = `
            <button class="hint-btn ${isMnemonicVisible ? 'showing' : ''}" id="hintBtn">${isMnemonicVisible ? '🙈 隐藏口诀' : '💡 提示'}</button>
            ${extraButtons}
            <div class="nav-group">
                <button id="prevBtn">◀ 上一题</button>
                <button id="catalogBtn" class="catalog-btn">📋 目录</button>
                <button id="randomBtn" class="random-btn">🎲 随机</button>
                <button id="nextBtn">下一题 ▶</button>
            </div>
        `;

        // ======== 绑定所有按钮事件 ========
        // 口诀
        document.getElementById('hintBtn').addEventListener('click', () => {
            isMnemonicVisible = !isMnemonicVisible;
            renderCard();
        });

        // 答案相关
        const addAnswerBtn = document.getElementById('addAnswerBtn');
        if (addAnswerBtn) {
            addAnswerBtn.addEventListener('click', () => {
                showEditModal('添加答案', '', (val) => {
                    saveQuestionField('answerText', val.trim());
                });
            });
        }
        const editAnswerBtn = document.getElementById('editAnswerBtn');
        if (editAnswerBtn) {
            editAnswerBtn.addEventListener('click', () => {
                showEditModal('修改答案', q.answerText || '', (val) => {
                    saveQuestionField('answerText', val.trim());
                });
            });
        }
        const toggleAnswerBtn = document.getElementById('toggleAnswerBtn');
        if (toggleAnswerBtn) {
            toggleAnswerBtn.addEventListener('click', () => {
                isAnswerVisible = !isAnswerVisible;
                renderCard();
            });
        }
        const deleteAnswerBtn = document.getElementById('deleteAnswerBtn');
        if (deleteAnswerBtn) {
            deleteAnswerBtn.addEventListener('click', () => {
                if (confirm('确定要删除答案吗？')) {
                    saveQuestionField('answerText', '');
                }
            });
        }

        // 备注相关
        const addRemarkBtn = document.getElementById('addRemarkBtn');
        if (addRemarkBtn) {
            addRemarkBtn.addEventListener('click', () => {
                showEditModal('添加备注', '', (val) => {
                    saveQuestionField('remarks', val.trim());
                });
            });
        }
        const editRemarkBtn = document.getElementById('editRemarkBtn');
        if (editRemarkBtn) {
            editRemarkBtn.addEventListener('click', () => {
                showEditModal('修改备注', q.remarks || '', (val) => {
                    saveQuestionField('remarks', val.trim());
                });
            });
        }
        const toggleRemarkBtn = document.getElementById('toggleRemarkBtn');
        if (toggleRemarkBtn) {
            toggleRemarkBtn.addEventListener('click', () => {
                isRemarkVisible = !isRemarkVisible;
                renderCard();
            });
        }
        const deleteRemarkBtn = document.getElementById('deleteRemarkBtn');
        if (deleteRemarkBtn) {
            deleteRemarkBtn.addEventListener('click', () => {
                if (confirm('确定要删除备注吗？')) {
                    saveQuestionField('remarks', '');
                }
            });
        }

        // 导航按钮
        document.getElementById('prevBtn').addEventListener('click', () => navigate(-1));
        document.getElementById('nextBtn').addEventListener('click', () => navigate(1));
        document.getElementById('randomBtn').addEventListener('click', goRandom);
        document.getElementById('catalogBtn').addEventListener('click', showCatalog);

        updateStatsAndUI();
    }

    // ---------- 导航 ----------
    function navigate(delta) {
        if (!filteredQuestions.length) return;
        isMnemonicVisible = false;
        isAnswerVisible = false;
        isRemarkVisible = false;
        let newIdx = currentIndex + delta;
        if (newIdx < 0) newIdx = filteredQuestions.length - 1;
        if (newIdx >= filteredQuestions.length) newIdx = 0;
        currentIndex = newIdx;
        if (currentMode === 'random') {
            currentMode = 'sequential';
            modeSelect.value = 'sequential';
        }
        renderCard();
    }

    function goRandom() {
        if (!filteredQuestions.length) return;
        isMnemonicVisible = false;
        isAnswerVisible = false;
        isRemarkVisible = false;
        if (currentMode !== 'random') {
            currentMode = 'random';
            modeSelect.value = 'random';
        }
        const randomIdx = Math.floor(Math.random() * filteredQuestions.length);
        currentIndex = randomIdx;
        renderCard();
    }

    function getUniqueCategories() {
        if (!currentLibraryId || !allLibraries[currentLibraryId]) return [];
        const questions = allLibraries[currentLibraryId].questions || [];
        const cats = new Set();
        questions.forEach(q => cats.add(q.category || '未分类'));
        return Array.from(cats).sort();
    }

    function showManageCategoryModal() {
        if (!currentLibraryId || !allLibraries[currentLibraryId]) {
            alert('请先选择一个题库');
            return;
        }
        const lib = allLibraries[currentLibraryId];
        const questions = lib.questions || [];
        const catMap = {};
        questions.forEach(q => {
            const cat = q.category || '未分类';
            catMap[cat] = (catMap[cat] || 0) + 1;
        });
        const categories = Object.keys(catMap).sort();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box" style="max-width:500px;">
                <h3>📂 管理分类</h3>
                <div style="max-height:50vh;overflow-y:auto;">
                    ${categories.map(cat => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f2f5;">
                            <span><strong>${escapeHtml(cat)}</strong> (${catMap[cat]}题)</span>
                            <button class="rename-cat-btn" data-cat="${escapeHtml(cat)}" style="padding:4px 12px;border:none;border-radius:12px;background:#eef2ff;color:#4f46e5;cursor:pointer;">重命名</button>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" id="manageCatCloseBtn">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 关闭
        overlay.querySelector('#manageCatCloseBtn').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        // 重命名事件
        overlay.querySelectorAll('.rename-cat-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const oldName = this.dataset.cat;
                const newName = prompt(`重命名分类“${oldName}”为：`, oldName);
                if (newName && newName.trim() !== oldName) {
                    // 检查新名称是否已存在且与旧名称不同
                    const newNameTrim = newName.trim();
                    if (categories.includes(newNameTrim) && newNameTrim !== oldName) {
                        if (!confirm(`分类“${newNameTrim}”已存在，是否将“${oldName}”的题目合并到“${newNameTrim}”？`)) {
                            return;
                        }
                    }
                    // 执行重命名
                    renameCategory(oldName, newNameTrim);
                    overlay.remove();
                }
            });
        });
    }

    function renameCategory(oldName, newName) {
        if (!currentLibraryId || !allLibraries[currentLibraryId]) return;
        const lib = allLibraries[currentLibraryId];
        let changed = false;
        lib.questions.forEach(q => {
            if ((q.category || '未分类') === oldName) {
                q.category = newName;
                changed = true;
            }
        });
        if (!changed) {
            alert('没有题目需要重命名');
            return;
        }
        // 保存
        saveLibraries(allLibraries);
        // 刷新下拉菜单
        switchToLibrary(currentLibraryId); // 会重新填充分类下拉
        // 如果当前选中的分类是旧名称，自动切换到新名称（如果新名称存在）
        if (categoryFilter.value === oldName) {
            // 尝试将下拉值设为新名称
            if (Array.from(categoryFilter.options).some(opt => opt.value === newName)) {
                categoryFilter.value = newName;
            } else {
                categoryFilter.value = 'all';
            }
        }
        // 重新应用筛选
        applyFilters();
        alert(`成功将分类“${oldName}”重命名为“${newName}”`);
    }

    // ---------- 筛选 ----------
    function applyFilters() {
        if (!currentLibraryId || !allLibraries[currentLibraryId]) {
            filteredQuestions = [];
            renderCard();
            return;
        }
        const questions = allLibraries[currentLibraryId].questions || [];
        const category = categoryFilter.value;
        const status = statusFilter.value;
        currentCategory = category;
        currentStatusFilter = status;

        let filtered = questions;
        if (category !== 'all') {
            filtered = filtered.filter(q => q.category === category);
        }
        if (status !== 'all') {
            filtered = filtered.filter(q => {
                const s = getQuestionStatus(currentLibraryId, q.id);
                return s === status;
            });
        }

        filteredQuestions = filtered;
        if (filteredQuestions.length) {
            currentIndex = 0;
        } else {
            currentIndex = 0;
        }

        isMnemonicVisible = false;
        isAnswerVisible = false;
        isRemarkVisible = false;

        if (currentMode === 'random') shuffleArray(filteredQuestions);
        renderCard();
    }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    function reshuffle() {
        if (currentMode === 'random') {
            shuffleArray(filteredQuestions);
            currentIndex = 0;
            isMnemonicVisible = false;
            isAnswerVisible = false;
            isRemarkVisible = false;
            renderCard();
        } else {
            alert('当前为顺序模式，请切换到随机模式再洗牌');
        }
    }

    // ---------- 题库管理 ----------
    function loadAllLibraries() {
        allLibraries = loadLibraries();
        Object.keys(allLibraries).forEach(id => {
            if (!allLibraries[id].id) allLibraries[id].id = id;
        });
        updateLibrarySelector();
        const lastLib = localStorage.getItem('lastLibraryId');
        if (lastLib && allLibraries[lastLib]) {
            switchToLibrary(lastLib);
        } else {
            const ids = Object.keys(allLibraries);
            if (ids.length) {
                switchToLibrary(ids[0]);
            } else {
                uploadScreen.style.display = 'flex';
                mainApp.style.display = 'none';
                currentLibraryId = null;
                currentQuestions = [];
                filteredQuestions = [];
                renderCard();
            }
        }
    }

    function updateLibrarySelector() {
        const current = librarySelect.value;
        librarySelect.innerHTML = '';
        Object.keys(allLibraries).forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = allLibraries[id].name || '未命名题库';
            librarySelect.appendChild(opt);
        });
        if (current && allLibraries[current]) {
            librarySelect.value = current;
        } else if (Object.keys(allLibraries).length) {
            librarySelect.value = Object.keys(allLibraries)[0];
        }
    }

    function switchToLibrary(libId) {
        if (!allLibraries[libId]) return;
        currentLibraryId = libId;
        currentQuestions = allLibraries[libId].questions || [];
        localStorage.setItem('lastLibraryId', libId);
        librarySelect.value = libId;
        const cats = new Set();
        currentQuestions.forEach(q => cats.add(q.category));
        categoryFilter.innerHTML = '<option value="all">📂 全部</option>';
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            categoryFilter.appendChild(opt);
        });
        isMnemonicVisible = false;
        isAnswerVisible = false;
        isRemarkVisible = false;
        currentIndex = 0;
        applyFilters();
    }

    function deleteLibrary(libId) {
        if (!allLibraries[libId]) return;
        if (!confirm(`确定要删除题库“${allLibraries[libId].name}”及其所有进度吗？`)) return;
        delete allLibraries[libId];
        saveLibraries(allLibraries);
        const allProgress = loadProgress();
        delete allProgress[libId];
        saveProgress(allProgress);
        const ids = Object.keys(allLibraries);
        if (ids.length) {
            switchToLibrary(ids[0]);
            updateLibrarySelector();
        } else {
            uploadScreen.style.display = 'flex';
            mainApp.style.display = 'none';
            currentLibraryId = null;
            currentQuestions = [];
            filteredQuestions = [];
            currentIndex = 0;
            isMnemonicVisible = false;
            isAnswerVisible = false;
            isRemarkVisible = false;
            renderCard();
            updateLibrarySelector();
            localStorage.removeItem('lastLibraryId');
        }
    }

    // ---------- 解析 Excel ----------
    function parseExcelData(workbook) {
        console.log('[parseExcelData] 开始解析');
        const sheets = workbook.SheetNames;
        if (!sheets.length) return [];
        const sheet = workbook.Sheets[sheets[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        console.log('[parseExcelData] 总行数:', json.length);
        const questions = [];
        let currentCategory = '';
        let colMap = null;
        let headerRowFound = false;

        for (let i = 0; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0) continue;

            // 打印每行前几列用于调试（可选）
            // console.log(`[parseExcelData] 行 ${i}:`, row.slice(0, 5).map(String));

            // 检测表头行：行中包含"序号"，且"序号"不在行首（避免误判）
            const hasSerial = row.some(cell => String(cell).trim() === '序号');
            if (hasSerial) {
                console.log('[parseExcelData] 找到表头行:', i);
                // 解析列映射
                const headers = row.map(h => String(h).trim());
                const findCol = (keywords) => {
                    for (let kw of keywords) {
                        const idx = headers.findIndex(h => h.includes(kw));
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };
                colMap = {
                    id: findCol(['序号', 'ID']),
                    type: findCol(['题型', '类型']),
                    question: findCol(['题目', '内容']),
                    options: findCol(['选项']),
                    answer: findCol(['正确答案', '答案', '参考答案']),
                    explanation: findCol(['解析', '口诀']),
                    category: findCol(['分类', '模块'])
                };
                if (colMap.question === -1 && headers.length > 1) colMap.question = 1;
                if (colMap.id === -1 && headers.length > 0) colMap.id = 0;
                console.log('[parseExcelData] 列映射:', colMap);
                headerRowFound = true;
                continue;
            }

            // 检测分类标题：行首不是数字，且不包含表头关键词
            const firstCell = String(row[0] || '').trim();
            const isNumberRow = /^\d+$/.test(firstCell);
            const isHeaderLike = row.some(cell => {
                const str = String(cell).trim();
                return str.includes('序号') || str.includes('题目') || str.includes('口诀');
            });

            if (!isNumberRow && !isHeaderLike && firstCell.length > 0) {
                // 取行中第一个非空单元格作为分类名
                const catName = row.find(cell => String(cell).trim()) || firstCell;
                if (catName && catName.trim() !== '序号') {
                    currentCategory = catName.trim();
                    console.log('[parseExcelData] 检测到分类:', currentCategory);
                    continue;
                }
            }

            // 数据行解析（当表头已找到且有列映射）
            if (colMap && headerRowFound) {
                const id = parseInt(row[colMap.id] || 0);
                if (isNaN(id) || id === 0) continue;
                const question = String(row[colMap.question] || '').trim();
                if (!question) continue;

                let category = '';
                if (colMap.category !== -1) {
                    category = String(row[colMap.category] || '').trim();
                }
                if (!category) {
                    category = currentCategory;
                }

                let type = String(row[colMap.type] || 'essay').trim().toLowerCase();
                if (type.includes('单选')) type = 'single';
                else if (type.includes('多选')) type = 'multi';
                else if (type.includes('填空')) type = 'fill';
                else if (type.includes('判断')) type = 'judge';
                else type = 'essay';

                let options = [];
                if (colMap.options !== -1) {
                    const optStr = String(row[colMap.options] || '').trim();
                    if (optStr) {
                        options = optStr.split(/\n|;|，/).filter(s => s.trim());
                    }
                }
                const answer = String(row[colMap.answer] || '').trim();
                const explanation = String(row[colMap.explanation] || '').trim();

                questions.push({
                    id: id,                   // 原始序号，后续会被 addNewLibrary 覆盖
                    displayId: id,            // 保留原始序号用于显示
                    category: category || '未分类',
                    question: question,
                    type: type,
                    options: options,
                    answer: type === 'essay' ? '' : answer,
                    explanation: explanation || (type === 'essay' ? '（无口诀）' : ''),
                    mnemonic: explanation || (type === 'essay' ? '（无口诀）' : ''),
                    answerText: type === 'essay' ? answer : '',
                    remarks: ''
                });
            } else {
                // 无表头模式兜底（旧格式）
                const num = parseInt(firstCell, 10);
                if (!isNaN(num) && row.length >= 3) {
                    const question = String(row[1] || '').trim();
                    const mnemonic = String(row[2] || '').trim();
                    if (question) {
                        questions.push({
                            id: num,
                            category: currentCategory || '未分类',
                            question: question,
                            type: 'essay',
                            options: [],
                            answer: '',
                            explanation: mnemonic || '（无口诀）',
                            mnemonic: mnemonic || '（无口诀）',
                            answerText: '',
                            remarks: ''
                        });
                    }
                }
            }
        }

        console.log('[parseExcelData] 解析完成，共', questions.length, '题');
        return questions;
    }

    function cleanText(text) {
        // 移除所有不可打印的控制字符（保留换行符和常见标点）
        return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
                .replace(/\s+/g, ' ')          // 合并多余空格
                .trim();
    }

    // ---------- 从粘贴文本解析题库 ----------
    function parseTextToQuestions(text) {
        const cleaned = cleanText(text);
        const lines = cleaned.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const questions = [];
        let currentCategory = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 检测分类标题：非数字开头，且不包含表头关键词
            if (!/^\d/.test(line) && !line.includes('序号') && !line.includes('题目') && !line.includes('口诀')) {
                const catName = line.trim();
                if (catName) {
                    currentCategory = catName;
                    console.log('[parseTextToQuestions] 检测到分类:', currentCategory);
                    continue;
                }
            }

            // 匹配序号行
            const match = line.match(/^(\d+)[.、．\s]*\s*(.*)/);
            if (match) {
                const id = parseInt(match[1], 10);
                let rest = match[2];
                let question = rest;
                let mnemonic = '';

                // 检查下一行是否为口诀
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1];
                    if (!/^\d/.test(nextLine) && !nextLine.includes('序号')) {
                        mnemonic = nextLine;
                        i++;
                    }
                }

                if (!mnemonic) {
                    const parts = rest.split(/\t+/);
                    if (parts.length >= 2) {
                        question = parts[0];
                        mnemonic = parts.slice(1).join(' ');
                    }
                }

                questions.push({
                    id: id,
                    displayId: id,
                    category: currentCategory || '未分类',
                    question: question.trim(),
                    type: 'essay',
                    options: [],
                    answer: '',
                    explanation: mnemonic.trim() || '（无口诀）',
                    mnemonic: mnemonic.trim() || '（无口诀）',
                    answerText: '',
                    remarks: ''
                });
            }
        }
        return questions;
    }

    // ---------- 解析 PDF 文件 ----------
    async function parsePdfFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        // 使用清洗函数去除不可见字符，并合并空格
        const cleaned = cleanText(fullText);
        return parseTextToQuestions(cleaned);
    }

    // ---------- 粘贴题库模态框 ----------
    function showPasteModal() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>📋 粘贴题库文本</h3>
                <p style="font-size:14px;color:#475569;margin-bottom:12px;">请将PDF中的表格内容（从“序号”行开始）粘贴到下方文本框中，系统将自动解析。</p>
                <textarea id="pasteTextarea" rows="10" placeholder="粘贴内容..."></textarea>
                <div class="modal-actions">
                    <button class="btn-secondary" id="pasteCancelBtn">取消</button>
                    <button class="btn-primary" id="pasteConfirmBtn">解析并导入</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.querySelector('#pasteCancelBtn').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        overlay.querySelector('#pasteConfirmBtn').addEventListener('click', () => {
            const text = overlay.querySelector('#pasteTextarea').value;
            if (!text.trim()) {
                alert('请粘贴内容');
                return;
            }
            const questions = parseTextToQuestions(text);
            if (!questions.length) {
                alert('未能解析出任何题目，请检查格式是否包含序号和题目。');
                return;
            }
            const defaultName = '粘贴题库';
            const name = prompt('请输入题库名称：', defaultName) || defaultName;
            addNewLibrary(name, questions);
            close();
        });
    }

    // ---------- 添加新题库 ----------
    function addNewLibrary(name, questions) {
        // 重新分配全局唯一 ID，同时保留 displayId
        questions.forEach((q, index) => {
            q.uid = index + 1;           // 新增全局唯一ID
            if (!q.displayId) {
                q.displayId = q.id || index + 1; // 兼容旧数据
            }
            // 可选：如果希望显示ID连续，可以忽略原始 displayId，但为了保留原始序号，我们不覆盖
        });
        // 将 id 设置为 uid（用于与现有代码兼容，因为现有代码大量使用 q.id）
        questions.forEach(q => {
            q.id = q.uid;
        });

        if (!questions || questions.length === 0) {
            alert('题库为空，无法添加');
            return;
        }
        const id = 'lib_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        allLibraries[id] = { id, name, questions };
        saveLibraries(allLibraries);
        setLibraryProgress(id, {});
        updateLibrarySelector();
        switchToLibrary(id);
        uploadScreen.style.display = 'none';
        mainApp.style.display = 'flex';
    }

    // ---------- 统一文件处理（支持 Excel 和 PDF） ----------
    function handleFileUpload(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'pdf') {
            // PDF 解析
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            parsePdfFile(file).then(questions => {
                if (!questions.length) {
                    alert('未能从 PDF 中解析出题目，请检查内容格式。');
                    return;
                }
                // 去重检查
                const matchedId = findMatchingLibrary(questions);
                if (matchedId) {
                    const libName = allLibraries[matchedId].name;
                    if (confirm(`检测到题库“${libName}”与当前导入内容相同，是否切换到该题库？`)) {
                        switchToLibrary(matchedId);
                        uploadScreen.style.display = 'none';
                        mainApp.style.display = 'flex';
                        return;
                    }
                }
                const defaultName = file.name.replace(/\.[^.]+$/, '');
                promptForLibraryName(defaultName, (name) => {
                    if (name) {
                        addNewLibrary(name, questions);
                    }
                });
            }).catch(err => {
                alert('PDF 解析失败：' + err.message);
                console.error(err);
            });
        } else {
            // Excel 解析
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const parsed = parseExcelData(workbook);
                    if (!parsed.length) {
                        alert('未能解析出题目，请检查 Excel 格式。');
                        return;
                    }
                    parsed.sort((a, b) => a.id - b.id);
                    const matchedId = findMatchingLibrary(parsed);
                    if (matchedId) {
                        const libName = allLibraries[matchedId].name;
                        if (confirm(`检测到题库“${libName}”与当前上传内容相同，是否切换到该题库？\n（点击“确定”切换，点击“取消”仍新建）`)) {
                            switchToLibrary(matchedId);
                            uploadScreen.style.display = 'none';
                            mainApp.style.display = 'flex';
                            return;
                        }
                    }
                    const defaultName = file.name.replace(/\.[^.]+$/, '');
                    promptForLibraryName(defaultName, (name) => {
                        if (name) {
                            addNewLibrary(name, parsed);
                        }
                    });
                } catch (err) {
                    alert('解析失败：' + err.message);
                }
            };
            reader.readAsArrayBuffer(file);
        }
    }

    function importJsonLibrary(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const libData = JSON.parse(e.target.result);
                if (!libData.questions || !Array.isArray(libData.questions) || libData.questions.length === 0) {
                    alert('无效的 JSON 题库文件');
                    return;
                }
                const questions = libData.questions.map(q => ({
                    id: q.id || 0,
                    displayId: q.displayId || q.id,
                    category: q.category || '未分类',
                    question: q.question || '',
                    type: q.type || 'essay',
                    options: q.options || [],
                    answer: q.answer || '',
                    explanation: q.explanation || q.mnemonic || '',
                    mnemonic: q.mnemonic || q.explanation || '',
                    answerText: q.answerText || '',
                    remarks: q.remarks || ''
                }));
                questions.forEach((q, idx) => q.id = idx + 1);
                const name = libData.name || file.name.replace(/\.[^.]+$/, '') || '导入的题库';
                const matchedId = findMatchingLibrary(questions);
                if (matchedId) {
                    if (confirm(`检测到题库“${allLibraries[matchedId].name}”与当前导入内容相同，是否切换到该题库？`)) {
                        switchToLibrary(matchedId);
                        uploadScreen.style.display = 'none';
                        mainApp.style.display = 'flex';
                        return;
                    }
                }
                addNewLibrary(name, questions);
            } catch (err) {
                alert('JSON 解析失败：' + err.message);
            }
        };
        reader.readAsText(file);
    }

    function findMatchingLibrary(questions) {
        const sortedNew = [...questions].sort((a, b) => a.id - b.id);
        const ids = Object.keys(allLibraries);
        for (let id of ids) {
            const existing = allLibraries[id].questions;
            if (existing.length !== sortedNew.length) continue;
            const sortedExisting = [...existing].sort((a, b) => a.id - b.id);
            if (JSON.stringify(sortedExisting) === JSON.stringify(sortedNew)) {
                return id;
            }
        }
        return null;
    }

    function promptForLibraryName(defaultName, callback) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>📚 新建题库</h3>
                <input type="text" id="libNameInput" placeholder="输入题库名称..." value="${escapeHtml(defaultName)}">
                <div class="modal-actions">
                    <button class="btn-secondary" id="modalCancelBtn">取消</button>
                    <button class="btn-primary" id="modalConfirmBtn">确定</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const input = overlay.querySelector('#libNameInput');
        input.focus();
        input.select();

        const close = () => overlay.remove();
        overlay.querySelector('#modalCancelBtn').addEventListener('click', () => {
            close();
            callback(null);
        });
        overlay.querySelector('#modalConfirmBtn').addEventListener('click', () => {
            const name = input.value.trim() || defaultName;
            close();
            callback(name);
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { close();
                callback(null); }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const name = input.value.trim() || defaultName;
                close();
                callback(name);
            }
        });
    }

    // ---------- 添加题目 ----------
    function showAddQuestionModal() {
        if (!currentLibraryId) {
            alert('请先选择或创建一个题库');
            return;
        }
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>➕ 添加题目</h3>
                <div class="modal-content">
                    <div class="form-group">
                        <label>题型</label>
                        <select id="qType">
                            <option value="essay">简答</option>
                            <option value="single">单选</option>
                            <option value="multi">多选</option>
                            <option value="fill">填空</option>
                            <option value="judge">判断</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>题目内容 *</label>
                        <textarea id="qQuestion" placeholder="请输入题目..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>分类（可选）</label>
                        <input type="text" id="qCategory" placeholder="例如：教育学、心理学...">
                    </div>
                    <div class="form-group" id="optionsGroup" style="display:none;">
                        <label>选项（每行一个）</label>
                        <textarea id="qOptions" placeholder="选项A&#10;选项B&#10;选项C&#10;选项D"></textarea>
                    </div>
                    <div class="form-group" id="answerGroup" style="display:block;">
                        <label>正确答案（单选/多选填选项字母，如 A；填空填答案文本；判断填“对”或“错”）</label>
                        <input type="text" id="qAnswer" placeholder="例如：A">
                    </div>
                    <div class="form-group" id="essayExtra" style="display:none;">
                        <label>参考答案（简答题专用）</label>
                        <textarea id="qAnswerText" placeholder="简答题的参考答案..."></textarea>
                    </div>
                    <div class="form-group" id="remarkGroup" style="display:none;">
                        <label>备注（可选）</label>
                        <textarea id="qRemarks" placeholder="补充说明、拓展知识..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>解析 / 口诀（可选）</label>
                        <textarea id="qExplanation" placeholder="解析或口诀"></textarea>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" id="modalCancelBtn">取消</button>
                    <button class="btn-primary" id="modalConfirmBtn">确定添加</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const typeSelect = overlay.querySelector('#qType');
        const optionsGroup = overlay.querySelector('#optionsGroup');
        const essayExtra = overlay.querySelector('#essayExtra');
        const remarkGroup = overlay.querySelector('#remarkGroup');
        const updateFields = () => {
            const val = typeSelect.value;
            optionsGroup.style.display = (val === 'single' || val === 'multi') ? 'block' : 'none';
            essayExtra.style.display = (val === 'essay') ? 'block' : 'none';
            remarkGroup.style.display = (val === 'essay') ? 'block' : 'none';
        };
        updateFields();
        typeSelect.addEventListener('change', updateFields);

        const close = () => overlay.remove();
        overlay.querySelector('#modalCancelBtn').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        overlay.querySelector('#modalConfirmBtn').addEventListener('click', () => {
            const type = typeSelect.value;
            const question = overlay.querySelector('#qQuestion').value.trim();
            if (!question) {
                alert('请输入题目内容');
                return;
            }
            const category = overlay.querySelector('#qCategory').value.trim() || '自定义';
            let options = [];
            if (type === 'single' || type === 'multi') {
                const optText = overlay.querySelector('#qOptions').value;
                options = optText.split('\n').filter(s => s.trim());
                if (options.length < 2) {
                    alert('选择题至少需要2个选项');
                    return;
                }
            }
            const answer = overlay.querySelector('#qAnswer').value.trim();
            const explanation = overlay.querySelector('#qExplanation').value.trim();
            const answerText = overlay.querySelector('#qAnswerText').value.trim();
            const remarks = overlay.querySelector('#qRemarks').value.trim();

            const questions = allLibraries[currentLibraryId].questions;
            const maxId = questions.reduce((max, q) => Math.max(max, q.id), 0);
            const newId = maxId + 1;

            const newQuestion = {
                id: newId,
                displayId: newId,
                category: category,
                question: question,
                type: type,
                options: options,
                answer: type === 'essay' ? '' : answer,
                explanation: explanation || (type === 'essay' ? '（无口诀）' : ''),
                mnemonic: explanation || (type === 'essay' ? '（无口诀）' : ''),
                answerText: type === 'essay' ? answerText : '',
                remarks: type === 'essay' ? remarks : ''
            };

            questions.push(newQuestion);
            saveLibraries(allLibraries);
            switchToLibrary(currentLibraryId);
            if (filteredQuestions.length) {
                currentIndex = filteredQuestions.length - 1;
                renderCard();
            }
            close();
            alert('✅ 题目添加成功！');
        });
    }

    // ---------- 导出题库 ----------
    function exportLibrary() {
        if (!currentLibraryId || !allLibraries[currentLibraryId]) {
            alert('请先选择一个题库');
            return;
        }
        const lib = allLibraries[currentLibraryId];
        const name = lib.name || '未命名题库';

        const jsonData = JSON.stringify(lib, null, 2);
        const jsonBlob = new Blob([jsonData], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const aJson = document.createElement('a');
        aJson.href = jsonUrl;
        aJson.download = `${name}.json`;
        document.body.appendChild(aJson);
        aJson.click();
        document.body.removeChild(aJson);
        URL.revokeObjectURL(jsonUrl);

        const questions = lib.questions || [];
        const rows = [
            ['序号', '题型', '分类', '题目', '选项', '正确答案', '解析/口诀', '参考答案', '备注']
        ];
        questions.forEach(q => {
            const optStr = (q.options || []).join('; ');
            rows.push([
                q.displayId || q.id,           // 显示序号
                q.category || '',               // 分类
                q.type || 'essay',              // 题型
                q.question,                     // 题目
                optStr,                         // 选项
                q.answer || '',                 // 正确答案
                q.explanation || q.mnemonic || '', // 解析/口诀
                q.answerText || '',             // 参考答案
                q.remarks || ''                 // 备注
            ]);
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, '题目');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const xlsxBlob = new Blob([wbout], { type: 'application/octet-stream' });
        const xlsxUrl = URL.createObjectURL(xlsxBlob);
        const aXlsx = document.createElement('a');
        aXlsx.href = xlsxUrl;
        aXlsx.download = `${name}.xlsx`;
        document.body.appendChild(aXlsx);
        aXlsx.click();
        document.body.removeChild(aXlsx);
        URL.revokeObjectURL(xlsxUrl);

        alert('✅ 题库已导出（JSON + XLSX）');
    }


    function exportJsonOnly() {
        if (!currentLibraryId || !allLibraries[currentLibraryId]) {
            alert('请先选择一个题库');
            return;
        }
        const lib = allLibraries[currentLibraryId];
        const name = lib.name || '未命名题库';
        const jsonData = JSON.stringify(lib, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('✅ 题库已导出为 JSON 文件');
    }

    // ---------- 导出 PDF ----------
    function exportPdf() {
        if (!currentLibraryId || !allLibraries[currentLibraryId]) {
            alert('请先选择一个题库');
            return;
        }
        const lib = allLibraries[currentLibraryId];
        const questions = lib.questions || [];
        let printContent = `
            <html>
            <head><title>${escapeHtml(lib.name)} - 题库</title>
            <style>
                body { font-family: system-ui, sans-serif; padding: 20px; }
                h1 { font-size: 24px; }
                .q-item { margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 15px; }
                .q-title { font-weight: bold; }
                .q-answer { margin-top: 8px; color: #2d7d2d; }
                .q-remark { margin-top: 4px; color: #555; font-style: italic; }
                .q-mnemonic { margin-top: 4px; color: #8a6d3b; }
                .q-options { margin-top: 4px; color: #1e293b; }
                @media print { .q-item { page-break-inside: avoid; } }
            </style>
            </head>
            <body>
            <h1>${escapeHtml(lib.name)} - 全部题目</h1>
        `;
        questions.forEach(q => {
            const typeLabel = { essay: '简答', single: '单选', multi: '多选', fill: '填空', judge: '判断' } [q
                .type] || q.type;
            printContent += `
                <div class="q-item">
                    <div class="q-title">#${q.id} [${typeLabel}] ${escapeHtml(q.question)}</div>
                    ${q.options && q.options.length ? `<div class="q-options">选项：${q.options.map((o,i)=>String.fromCharCode(65+i)+'. '+o).join('；')}</div>` : ''}
                    ${q.answer ? `<div class="q-answer">✅ 答案：${escapeHtml(q.answer)}</div>` : ''}
                    ${q.answerText ? `<div class="q-answer">📝 参考答案：${escapeHtml(q.answerText)}</div>` : ''}
                    ${q.remarks ? `<div class="q-remark">📌 备注：${escapeHtml(q.remarks)}</div>` : ''}
                    ${q.explanation && q.explanation !== '（无口诀）' ? `<div class="q-mnemonic">💡 解析/口诀：${escapeHtml(q.explanation)}</div>` : ''}
                </div>
            `;
        });
        printContent += `</body></html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    // ---------- 导出/导入进度 ----------
    function getExportData() {
        return JSON.stringify(loadProgress(), null, 2);
    }
    function exportAllProgress() {
        const dataStr = getExportData();
        try {
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `all_progress_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            showModal('📋 导出全部进度', dataStr, '复制', (text) => {
                copyToClipboard(text);
            });
        }
    }
    function copyAllProgress() {
        const dataStr = getExportData();
        copyToClipboard(dataStr);
    }
    function importProgressFromPaste() {
        showModal('📋 从剪贴板导入进度（覆盖所有题库进度）', '', '导入', (text) => {
            try {
                const data = JSON.parse(text);
                if (typeof data === 'object' && data !== null) {
                    if (confirm('导入将覆盖当前所有题库的进度记录，确定继续吗？')) {
                        saveProgress(data);
                        if (currentLibraryId && allLibraries[currentLibraryId]) {
                            switchToLibrary(currentLibraryId);
                        } else {
                            applyFilters();
                        }
                        alert('✅ 导入成功！');
                    }
                } else {
                    alert('❌ 无效的进度数据');
                }
            } catch (err) {
                alert('❌ 解析失败：' + err.message);
            }
        });
    }
    function importProgressFromFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (typeof data === 'object' && data !== null) {
                    if (confirm('导入将覆盖当前所有题库的进度记录，确定继续吗？')) {
                        saveProgress(data);
                        if (currentLibraryId && allLibraries[currentLibraryId]) {
                            switchToLibrary(currentLibraryId);
                        } else {
                            applyFilters();
                        }
                        alert('✅ 导入成功！');
                    }
                } else {
                    alert('❌ 无效的进度文件');
                }
            } catch (err) {
                alert('❌ 解析失败：' + err.message);
            }
        };
        reader.readAsText(file);
    }

    // ---------- 模态框 ----------
    function showModal(title, initialText, actionLabel, onAction) {
        const old = document.querySelector('.modal-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>${title}</h3>
                <textarea id="modalTextarea">${escapeHtml(initialText)}</textarea>
                <div class="modal-actions">
                    <button class="btn-secondary" id="modalCloseBtn">关闭</button>
                    <button class="btn-primary" id="modalActionBtn">${actionLabel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const closeModal = () => overlay.remove();
        overlay.querySelector('#modalCloseBtn').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        overlay.querySelector('#modalActionBtn').addEventListener('click', () => {
            const text = overlay.querySelector('#modalTextarea').value;
            onAction(text);
            closeModal();
        });
    }

    // ---------- 帮助 ----------
    function showHelp() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <h3>❓ 使用帮助</h3>
                <div class="help-content">
                    <ul>
                        <li>👆 左右滑动卡片切换题目</li>
                        <li>💡 点击“提示”查看口诀/解析（切换题目后自动隐藏）</li>
                        <li>📝 简答题下方有“添加答案/修改答案”和“添加备注/修改备注”按钮，可随时编辑</li>
                        <li>👁️ 显示/隐藏答案和备注，独立控制</li>
                        <li>⬅️➡️ 使用“上一题/下一题”按钮或键盘方向键</li>
                        <li>🎲 点击“随机”跳转至随机题目</li>
                        <li>📋 点击“目录”可查看所有题目列表，按颜色区分状态：绿色=已掌握，红色=待复习，灰色=未开始</li>
                        <li>✅🔄 底部“掌握/复习”标记题目状态，“重置”取消标记</li>
                        <li>📂 顶部下拉框切换不同题库，➕ 上传新题库，🗑️ 删除题库</li>
                        <li>➕ 点击“添加题目”可自定义任意题型（简答题有独立的答案和备注）</li>
                        <li>📤 点击“导出题库”可下载 JSON 和 Excel 文件</li>
                        <li>📄 点击“导出PDF”可生成当前题库的打印版（含所有答案和备注）</li>
                        <li>💾 底部“导出/导入”可备份所有题库进度，跨设备迁移</li>
                        <li>📄 支持直接上传 PDF 文件，自动解析表格内容生成题库</li>
                    </ul>
                </div>
                <div class="modal-actions">
                    <button class="btn-primary" id="helpCloseBtn">知道了</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('#helpCloseBtn').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    // ---------- 复制 ----------
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                alert('✅ 已复制到剪贴板！');
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            alert('✅ 已复制到剪贴板！');
        } catch (e) {
            alert('❌ 复制失败，请手动复制。');
        }
        document.body.removeChild(textarea);
    }

    // ---------- 触摸滑动 ----------
    let touchStartX = 0,
        touchStartY = 0,
        isSwiping = false;

    // ---------- 事件绑定 ----------
    function bindEvents() {
        librarySelect.addEventListener('change', (e) => {
            const id = e.target.value;
            if (id && allLibraries[id]) {
                switchToLibrary(id);
            }
        });

        deleteLibraryBtn.addEventListener('click', () => {
            if (currentLibraryId) deleteLibrary(currentLibraryId);
        });

        addLibraryBtn.addEventListener('click', () => {
            uploadScreen.style.display = 'flex';
            mainApp.style.display = 'none';
        });

        categoryFilter.addEventListener('change', () => { isMnemonicVisible = false;
            isAnswerVisible = false;
            isRemarkVisible = false;
            applyFilters(); });
        statusFilter.addEventListener('change', () => { isMnemonicVisible = false;
            isAnswerVisible = false;
            isRemarkVisible = false;
            applyFilters(); });
        modeSelect.addEventListener('change', (e) => {
            const newMode = e.target.value;
            if (newMode === 'random' && currentMode !== 'random') {
                shuffleArray(filteredQuestions);
                currentIndex = 0;
            } else if (newMode === 'sequential' && currentMode === 'random') {
                filteredQuestions.sort((a, b) => a.id - b.id);
                currentIndex = 0;
            }
            currentMode = newMode;
            isMnemonicVisible = false;
            isAnswerVisible = false;
            isRemarkVisible = false;
            renderCard();
        });
        shuffleBtn.addEventListener('click', reshuffle);

        actionMaster.addEventListener('click', () => {
            if (!currentLibraryId || !filteredQuestions.length) return;
            const q = filteredQuestions[currentIndex];
            setQuestionStatus(currentLibraryId, q.id, 'mastered');
        });
        actionReview.addEventListener('click', () => {
            if (!currentLibraryId || !filteredQuestions.length) return;
            const q = filteredQuestions[currentIndex];
            setQuestionStatus(currentLibraryId, q.id, 'review');
        });
        actionReset.addEventListener('click', () => {
            if (!currentLibraryId || !filteredQuestions.length) return;
            const q = filteredQuestions[currentIndex];
            setQuestionStatus(currentLibraryId, q.id, 'none');
        });
        helpBtn.addEventListener('click', showHelp);

        addQuestionBtn.addEventListener('click', showAddQuestionModal);
        document.getElementById('manageCategoryBtn').addEventListener('click', showManageCategoryModal);
        pasteLibraryBtn.addEventListener('click', showPasteModal);
        exportLibraryBtn.addEventListener('click', exportLibrary);
        exportPdfBtn.addEventListener('click', exportJsonOnly);

        exportBtn.addEventListener('click', exportAllProgress);
        copyBtn.addEventListener('click', copyAllProgress);
        pasteImportBtn.addEventListener('click', importProgressFromPaste);
        importBtn.addEventListener('click', () => importFileInput.click());

        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext === 'json') {
                importJsonLibrary(file);
            } else if (ext === 'xlsx' || ext === 'xls' || ext === 'pdf') {
                handleFileUpload(file);
            } else {
                alert('不支持的文件格式，请选择 .xlsx, .xls, .pdf 或 .json');
            }
            e.target.value = '';
        });

        resetAllBtn.addEventListener('click', () => {
            if (currentLibraryId) resetAllProgressForLibrary(currentLibraryId);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') navigate(-1);
            else if (e.key === 'ArrowRight') navigate(1);
        });

        const wrapper = document.getElementById('cardWrapper');
        wrapper.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            isSwiping = false;
        }, { passive: true });

        wrapper.addEventListener('touchmove', (e) => {
            if (!touchStartX) return;
            const touch = e.touches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
                isSwiping = true;
                e.preventDefault();
            }
        }, { passive: false });

        wrapper.addEventListener('touchend', (e) => {
            if (!touchStartX || !isSwiping) {
                touchStartX = 0;
                touchStartY = 0;
                return;
            }
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchStartX;
            if (deltaX > 50) navigate(-1);
            else if (deltaX < -50) navigate(1);
            touchStartX = 0;
            touchStartY = 0;
            isSwiping = false;
        }, { passive: true });

        uploadScreen.addEventListener('click', () => fileInput.click());
        uploadScreen.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadScreen.style.borderColor = '#4f46e5';
            uploadScreen.style.background = '#eef2ff';
        });
        uploadScreen.addEventListener('dragleave', () => {
            uploadScreen.style.borderColor = '#cbd5e1';
            uploadScreen.style.background = '#fafcff';
        });
        uploadScreen.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadScreen.style.borderColor = '#cbd5e1';
            uploadScreen.style.background = '#fafcff';
            if (e.dataTransfer.files.length) {
                const file = e.dataTransfer.files[0];
                const ext = file.name.split('.').pop().toLowerCase();
                if (ext === 'json') {
                    importJsonLibrary(file);
                } else if (ext === 'xlsx' || ext === 'xls' || ext === 'pdf') {
                    handleFileUpload(file);
                } else {
                    alert('不支持的文件格式，请上传 .xlsx, .xls, .pdf 或 .json');
                }
                fileInput.files = e.dataTransfer.files;
            }
        });

        fileInput.addEventListener('change', function(e) {
            if (this.files.length) {
                const file = this.files[0];
                const ext = file.name.split('.').pop().toLowerCase();
                if (ext === 'xlsx' || ext === 'xls' || ext === 'pdf') {
                    handleFileUpload(file);
                } else {
                    alert('不支持的文件格式，请选择 .xlsx, .xls 或 .pdf');
                }
                this.value = ''; // 允许重复上传同一个文件
            }
        });
    }

    // ---------- 暴露全局 ----------
    window.parseExcelData = parseExcelData;
    window.addNewLibrary = addNewLibrary;
    window.exportPdf = exportPdf;
    window.showCatalog = showCatalog;
    window.parseTextToQuestions = parseTextToQuestions;

    // ---------- 初始化 ----------
    function init() {
        // ---------- 读取版本号（仅限 HTTP/HTTPS 环境） ----------
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            fetch('version.txt')
                .then(res => {
                    if (!res.ok) throw new Error('版本文件不存在');
                    return res.text();
                })
                .then(ver => {
                    const v = ver.trim();
                    const versionEl = document.getElementById('appVersion');
                    if (versionEl) {
                        versionEl.textContent = 'v' + v;
                    }
                    console.log('当前版本:', v);
                    window.APP_VERSION = v;
                })
                .catch(err => {
                    console.warn('未找到 version.txt，使用默认版本', err);
                    // 保留默认版本
                });
        } else {
            console.warn('本地环境，跳过 version.txt 加载，使用默认版本');
        }
        // 原有的 bindEvents, loadAllLibraries 等代码...
        bindEvents();
        loadAllLibraries();
        if (Object.keys(allLibraries).length === 0) {
            uploadScreen.style.display = 'flex';
            mainApp.style.display = 'none';
        } else {
            uploadScreen.style.display = 'none';
            mainApp.style.display = 'flex';
        }
        console.log('✅ 刷题器初始化完成');
        // ---------- 测试接口 ----------
        window.importFromUrl = async function(url, name) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('网络请求失败');
                const arrayBuffer = await response.arrayBuffer();
                // 根据文件扩展名判断
                const ext = url.split('.').pop().toLowerCase();
                if (ext === 'xlsx' || ext === 'xls') {
                    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                    const questions = parseExcelData(workbook);
                    if (!questions.length) { alert('解析失败'); return; }
                    const defaultName = name || url.split('/').pop().replace(/\.[^.]+$/, '');
                    addNewLibrary(defaultName, questions);
                } else if (ext === 'pdf') {
                    // 需要 PDF.js，但这里略
                    alert('PDF导入请使用粘贴功能或文件上传');
                } else {
                    alert('不支持的文件类型');
                }
            } catch (e) {
                alert('导入失败: ' + e.message);
            }
        };
        window.importExcelBuffer = function(buffer, name) {
            const workbook = XLSX.read(buffer, { type: 'array' });
            const questions = parseExcelData(workbook);
            if (!questions.length) { alert('解析失败'); return; }
            addNewLibrary(name || '导入题库', questions);
        };
    }

    init();
})();