import { useState, useCallback } from 'react';
import { questionsApi } from '../services/api';

function QuestionBank() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const jsonFile = files.find(f => f.name.endsWith('.json'));

    if (!jsonFile) {
      setResult({ success: false, message: '请上传 JSON 格式的题库文件' });
      return;
    }

    await importFile(jsonFile);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setResult({ success: false, message: '请上传 JSON 格式的题库文件' });
      return;
    }

    await importFile(file);
  }, []);

  const importFile = async (file: File) => {
    setUploading(true);
    setResult(null);

    try {
      const response = await questionsApi.importQuestions(file);
      setResult({
        success: true,
        message: response.data.message || `成功导入 ${response.data.count} 道题目`,
      });
    } catch (error: any) {
      const detail = error.response?.data?.detail || '导入失败，请检查文件格式';
      setResult({ success: false, message: detail });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <header style={{ marginBottom: '40px' }}>
        <h1>题库管理</h1>
        <p className="subtitle">导入和管理你的题库资源</p>
      </header>

      <div className="card">
        <div className="card-title">导入题库</div>
        <p style={{ 
          color: 'var(--color-muted)', 
          marginBottom: '24px',
          fontStyle: 'italic'
        }}>
          上传 JSON 格式的题库文件，支持拖放上传
        </p>

        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {uploading ? (
            <div className="drop-zone-content">
              <div className="spinner"></div>
              <p className="drop-zone-text">正在导入...</p>
            </div>
          ) : (
            <div className="drop-zone-content">
              <div className="drop-zone-icon">✦</div>
              <p className="drop-zone-text">
                {isDragging ? '释放文件以上传' : '拖放题库文件到此处，或点击选择文件'}
              </p>
              <p className="drop-zone-hint">支持 .json 格式</p>
            </div>
          )}
        </div>

        {result && (
          <div className={`import-result ${result.success ? 'success' : 'error'}`}>
            {result.message}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-title">题库格式说明</div>
        <div style={{ fontFamily: 'var(--font-body)' }}>
          <p style={{ marginBottom: '16px', lineHeight: '1.8' }}>
            题库文件需要为 JSON 格式，结构如下：
          </p>
          <pre style={{ 
            background: 'var(--color-carbon)', 
            color: 'var(--color-ivory)',
            padding: '20px 24px',
            borderRadius: '4px',
            overflow: 'auto',
            fontFamily: "'JetBrains Mono', 'Consolas', monospace",
            fontSize: '0.875rem',
            lineHeight: '1.6'
          }}>{`[
  {
    "num": 1,
    "question": "题目内容 A.选项A B.选项B C.选项C",
    "answer": "A"
  },
  ...
]`}</pre>
          <ul style={{ 
            marginTop: '20px', 
            paddingLeft: '24px', 
            color: 'var(--color-muted)',
            lineHeight: '2'
          }}>
            <li><code style={{ 
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--color-parchment)',
              padding: '2px 6px',
              borderRadius: '2px'
            }}>num</code> — 题目编号</li>
            <li><code style={{ 
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--color-parchment)',
              padding: '2px 6px',
              borderRadius: '2px'
            }}>question</code> — 题目内容，选项用 A. B. C. 格式拼接</li>
            <li><code style={{ 
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--color-parchment)',
              padding: '2px 6px',
              borderRadius: '2px'
            }}>answer</code> — 正确答案（单个字母）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default QuestionBank;
