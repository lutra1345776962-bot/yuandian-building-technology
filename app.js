/* Offline course reader. No remote libraries or network services. */
(() => {
'use strict';
const D=window.COURSE_DATA;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pageByNumber=new Map(D.slides.map(s=>[s.page,s]));
const page=n=>pageByNumber.get(n);
const initial=()=>({version:1,sourceSha256:D.stats.sourceSha256,favorites:[],mastered:[],answers:{},lastLesson:null});
let state=initial(),memoryOnly=false;
try{const raw=localStorage.getItem('architecture-course-v1');if(raw){const value=JSON.parse(raw);if(value.version===1&&value.sourceSha256===D.stats.sourceSha256)state={...initial(),...value};}}catch{memoryOnly=true;}
const lessons={
 thermal:{title:'热阻与传热系数',module:'建筑热工学',en:'THERMAL PERFORMANCE',desc:'分清材料层的热阻、整个围护结构的传热能力，以及公式成立的条件。',pages:[26],tabs:['定义与公式'],intro:'先看指标描述的对象，再看单位与公式。热阻和传热系数的比较，必须保持边界条件一致。',steps:['指标与单位','公式与适用条件','归纳与自查'],next:'skylight',type:'公式与概念'},
 skylight:{title:'天窗分类与比较',module:'建筑光学',en:'DAYLIGHT & SKYLIGHTS',desc:'沿着分类、采光特点和构造条件，理解不同天窗的选型依据。',pages:[71,72,73,74],tabs:['矩形天窗','横向、梯形与井式','锯齿形与平天窗','分类比较'],intro:'教材将天窗分为矩形、锯齿形和平天窗三类。井式天窗归入矩形类，比较采光效率时须说明相同条件。',steps:['分类与形式','图示与设计条件','比较与答题'],next:'roof',type:'分类与图示'},
 roof:{title:'正置式与倒置式屋面',module:'建筑构造',en:'ROOF CONSTRUCTION',desc:'从两种构造的层次关系开始，理解保温、防水、材料受湿与节点处理。',pages:[147,148,149,150],tabs:['层次对照','正置式屋面','倒置式屋面','女儿墙与板缝','比较与作答'],intro:'识别关键：正置式的防水层在保温层上方，倒置式的保温层在防水层上方。两者都需要合理排水、连续防水和可靠收头。',steps:['辨认保温与防水层','理解各层作用','检查节点与排水','比较并组织答案'],next:'bim',type:'构造读图'},
 bim:{title:'BIM、CIM与数字孪生',module:'技术热点',en:'INFORMATION & DIGITAL MODELS',desc:'比较对象尺度、信息组织与数据反馈，明确三个概念的联系和成立条件。',pages:[258,260,262],tabs:['BIM与软件','GIS、BIM与CIM','比较与参考答案'],intro:'三者可以衔接。建立三维模型并不自动意味着已形成具有数据连接和反馈的数字孪生。',steps:['概念与工具','尺度与信息衔接','比较与参考答案'],next:null,type:'概念比较'}
};
const lessonForPage=n=>Object.keys(lessons).find(k=>lessons[k].pages.includes(n));
let activeTab=0,currentLesson=null,filterModule='all',catalogQuery='',examYear='2025',activePracticeModule='all',toastTimer;
function save(){try{localStorage.setItem('architecture-course-v1',JSON.stringify(state));}catch{memoryOnly=true;toast('浏览器未能保存记录，请导出备份。');}}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2600);}
function titleBlock(eyebrow,title,desc,extra=''){return `<div class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${desc?`<p>${esc(desc)}</p>`:''}</div>${extra}</div>`;}
function tableHTML(t){return `<div class="table-scroll-hint">表格可左右滑动查看完整内容</div><div class="table-wrap" tabindex="0" aria-label="知识比较表，可左右滚动"><table><thead><tr>${t.rows[0].map(c=>`<th scope="col">${esc(c).replaceAll('\n','<br>')}</th>`).join('')}</tr></thead><tbody>${t.rows.slice(1).map(row=>`<tr>${row.map((c,i)=>`<${i===0?'th scope="row"':'td'}>${esc(c).replaceAll('\n','<br>')}</${i===0?'th':'td'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function pointHTML(text){let t=text.replace(/^\d+[．.、]\s*/,'');const colon=t.indexOf('：');return colon>0&&colon<20?`<strong>${esc(t.slice(0,colon+1))}</strong>${esc(t.slice(colon+1))}`:esc(t);}
function pointsFor(s){return s.blocks.filter(b=>/^(分点|本页归纳)/.test(b.name)).map(b=>b.text.replaceAll('\n',''));}
function figureHTML(s,index=0,label=''){
 const im=s.images[index];if(!im)return '';
 const caps=s.blocks.filter(b=>b.name.startsWith('图题'));const caption=(caps[index]?.text||s.title).replaceAll('\n','');
 return `<figure class="figure-card"><div class="figure-top"><b class="figure-label">${esc(label||s.title.split('：')[0])}</b></div><img src="${esc(im.src)}" alt="${esc(caption)}" loading="lazy" tabindex="0" role="button" aria-label="放大：${esc(caption)}" data-zoom="${esc(im.src)}" data-caption="${esc(caption)}"><figcaption>${esc(caption)}${s.page===147||s.page===148?'<br>室外侧在上，室内侧在下':''}</figcaption></figure>`;
}
function sourcesHTML(pages){const sources=[...new Set(pages.flatMap(n=>page(n).sources.length?page(n).sources:page(n).blocks.filter(b=>/^(来源)/.test(b.name)).map(b=>b.text)))];return sources.length?`<div class="source-note"><div>教材与参考资料</div>${sources.map(t=>`<div>${esc(t)}</div>`).join('')}</div>`:'';}
function home(){
 return titleBlock('COURSE READER','建筑技术学习手册','按章节理解知识，结合图示辨认构造，用练习检验记忆。')+`<div class="section-heading"><h2>按章节学习</h2><a href="#/catalog" class="text-link">打开完整目录 ↗</a></div><div class="module-grid">${D.modules.map((m,i)=>`<a class="module-row" href="#/catalog/${m.id}"><span class="module-number">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(m.title)}</h3><p>${esc(m.description)}</p></div><span class="arrow">↗</span></a>`).join('')}</div><div class="sample-notice">本版提供全量内容盘点与代表性页面，其他主题可在目录中查看清单预览，后续再逐章完成网页编排。</div><div class="download-row"><a href="交付文档/全量知识点清单.md" download>↓ 全量知识点清单</a><a href="交付文档/全量知识主题.csv" download>↓ 知识主题表</a><a href="交付文档/全量知识细目.csv" download>↓ 知识细目表</a><a href="交付文档/网站目录与迁移设计.md" download>↓ 网站目录与迁移设计</a><a href="交付文档/全量题库.csv" download>↓ 164题题库</a></div>`;
}
function slideSection(s){
 const points=pointsFor(s);
 const groups=s.blocks.filter(b=>b.name.startsWith('分组_')).map(b=>b.text);
 let figures=s.images.length?`<div class="figure-pair">${s.images.map((_,i)=>figureHTML(s,i,groups[i]||'')).join('')}</div><div class="figure-hint">点击图片可查看大图；图中的原标注保留。</div>`:'';
 // Text is grouped by actual shape positions where columns have independent numbering.
 let body='';
 if(s.page===73){
  for(let i=0;i<2;i++){const prefix=i===0?'分点_110_':'分点_665_';const ps=s.blocks.filter(b=>b.name.startsWith(prefix)).map(b=>b.text.replaceAll('\n',''));body+=`<h3>${esc(groups[i])}</h3><ol class="point-list">${ps.map(t=>`<li>${pointHTML(t)}</li>`).join('')}</ol>`;}
 }else if(s.page===72){
  const blocks=s.blocks;for(let i=0;i<groups.length;i++){const start=blocks.findIndex(b=>b.name.startsWith('分组_')&&b.text===groups[i]);let end=blocks.findIndex((b,j)=>j>start&&b.name.startsWith('分组_'));if(end<0)end=blocks.length;const ps=blocks.slice(start+1,end).filter(b=>b.name.startsWith('分点_')).map(b=>b.text.replaceAll('\n',''));body+=`<h3>${esc(groups[i])}</h3><ol class="point-list">${ps.map(t=>`<li>${pointHTML(t)}</li>`).join('')}</ol>`;}
 }else{body=points.length?`<ol class="point-list">${points.map(t=>`<li>${pointHTML(t)}</li>`).join('')}</ol>`:'';}
 return `<div class="body-section"><h2>${esc(s.title)}</h2>${figures}${s.tables.map(tableHTML).join('')}${body}</div>`;
}
function roofOverview(){return `<div class="figure-pair">${figureHTML(page(147),0,'正置式屋面')}${figureHTML(page(148),0,'倒置式屋面')}</div><div class="figure-hint">点击查看原图细节。先定位防水与保温，再辨认其他功能层。</div><div class="body-section"><h2>两种层次，怎样比较？</h2>${page(150).tables.map(tableHTML).join('')}<ol class="point-list">${pointsFor(page(150)).map(t=>`<li>${pointHTML(t)}</li>`).join('')}</ol></div><div class="teaching-note">继续读图：在上方切换“正置式屋面”和“倒置式屋面”，查看各层作用；切换“女儿墙与板缝”，检查防水上翻、保温衔接与分缝。</div>`;}
function lesson(key){
 const l=lessons[key];if(!l)return empty('未找到这个学习主题。');
 currentLesson=key;state.lastLesson=key;save();
 const p=l.pages[Math.min(key==='roof'?Math.max(0,activeTab-1):activeTab,l.pages.length-1)];
 const content=key==='roof'&&activeTab===0?roofOverview():slideSection(page(p));
 return `<div class="reader-layout"><article class="reader-main"><div class="lesson-heading"><div class="eyebrow">${esc(l.en)}</div><h1>${esc(l.title)}</h1><p class="lesson-description">${esc(l.desc)}</p><div class="lesson-meta"><span class="subject-label">${esc(l.module)}</span><span>${esc(l.type)}</span></div></div><div class="key-note"><strong>先抓住这一点</strong><br>${esc(l.intro)}</div><div class="content-tabs" role="tablist" aria-label="学习内容">${l.tabs.map((t,i)=>`<button role="tab" aria-selected="${activeTab===i}" class="${activeTab===i?'active':''}" data-tab="${i}" id="tab-${i}" aria-controls="lesson-panel">${esc(t)}</button>`).join('')}</div><div id="lesson-panel" role="tabpanel" aria-labelledby="tab-${activeTab}">${content}</div>${sourcesHTML(key==='roof'&&activeTab===0?[147,148,150]:[p])}<div class="lesson-bottom"><a href="#/catalog">← 返回全量目录</a>${l.next?`<a href="#/lesson/${l.next}">下一个主题：${esc(lessons[l.next].title)} →</a>`:`<a href="#/practice">查看全部填空练习 →</a>`}</div></article><aside class="reader-side"><div class="side-label">IN THIS TOPIC</div><h3>本节阅读路径</h3>${l.steps.map((s,i)=>`<div class="side-step"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(s)}</span></div>`).join('')}<div class="side-divider"></div><button class="side-button ${state.favorites.includes(key)?'selected':''}" data-favorite="${key}">${state.favorites.includes(key)?'★ 已收藏':'☆ 收藏这个主题'}</button><button class="side-button ${state.mastered.includes(key)?'selected':''}" data-mastered="${key}">${state.mastered.includes(key)?'✓ 已标记掌握':'○ 标记已掌握'}</button><p class="small-note">根据自己的理解标记，<br>之后可在“我的复习”中查看。</p><div class="side-divider"></div><a href="#/practice/${({thermal:'thermal',skylight:'optics',roof:'construction',bim:'all'})[key]}" class="text-link">${key==='bim'?'查看全部填空练习':'本模块全部填空题'} →</a></aside></div>`;
}
function isStudyItem(s){return !['cover','navigation','chapter','map'].includes(s.kind);}
function searchable(s){return [s.title,s.moduleTitle,s.group,...s.body,...s.tables.flatMap(t=>t.rows.flat())].join(' ').toLowerCase();}
function matches(s,q){return q.trim().toLowerCase().split(/\s+/).every(t=>searchable(s).includes(t));}
function examMatches(q,query){const text=[q.year,q.title,q.section,q.stem,...q.parts,q.note||''].join(' ').toLowerCase();return query.trim().toLowerCase().split(/\s+/).every(t=>text.includes(t));}
function examQuestionsHTML(query){
 const records=(D.examQuestions||[]).filter(q=>examMatches(q,query)&&(query.trim()||examYear==='all'||String(q.year)===examYear));
 return `<section class="exam-browser" aria-label="历年具体真题"><div class="exam-heading"><div><h3>历年具体题目</h3><p>2015—2025年 · 62道题目记录</p></div><a class="text-link" href="交付文档/历年真题题干.md" download>下载题干清单 ↓</a></div><p class="exam-provenance">根据所提供的技术题图片整理，年份按资料目录标注。保留原题号、子问及可见分值；资料不完整处单独说明，不补写未知题干。</p>${query.trim()?'<p class="small-note">正在全部年份中检索题干。</p>':`<div class="exam-year-filters" aria-label="真题年份"><button data-exam-year="all" class="${examYear==='all'?'active':''}">全部年份</button>${D.examYears.map(year=>`<button data-exam-year="${year}" class="${examYear===String(year)?'active':''}">${year}</button>`).join('')}</div>`}<div class="exam-count">当前显示 ${records.length} 道题目</div>${records.length?D.examYears.map(year=>{const qs=records.filter(q=>q.year===year);return qs.length?`<section class="exam-year-group"><h4>${year}年</h4>${qs.map(q=>`<article class="exam-question" id="${q.id}"><div class="exam-question-meta"><span>${esc(q.section)} · 第${esc(q.number)}题</span>${q.score!==null?`<span>${q.score}分</span>`:''}</div><h5>${esc(q.title)}</h5><p class="exam-stem">${esc(q.stem)}</p>${q.parts.length?`<ol class="exam-subquestions">${q.parts.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`:''}${q.figure?`<figure class="exam-figure"><img src="${esc(q.figure)}" alt="葡萄牙国家馆倒悬链顶棚屋盖题目附图" tabindex="0" role="button" aria-label="放大题目附图" data-zoom="${esc(q.figure)}" data-caption="2023年屋盖方案题附图"><figcaption>题目附图 · 点击放大</figcaption></figure>`:''}${q.note?`<p class="exam-note">资料说明：${esc(q.note)}</p>`:''}<div class="exam-related"><span>关联知识</span>${q.relatedPages.map(n=>{const s=page(n),key=lessonForPage(n);return `<a href="${key?'#/lesson/'+key:`#/catalog/${s.module}?page=${s.page}`}">${esc(s.title)} ↗</a>`;}).join('')}</div></article>`).join('')}</section>`:'';}).join(''):'<p class="small-note">当前没有匹配题目。</p>'}</section>`;
}
function catalogCount(selected,query){const examCount=(filterModule==='all'||filterModule==='exam')?(D.examQuestions||[]).filter(q=>examMatches(q,query)).length:0;const exerciseModules=new Set(selected.filter(s=>s.kind==='exercise').map(s=>s.module));const practiceCount=D.questions.filter(q=>exerciseModules.has(q.module)).length;const records=selected.filter(s=>s.kind!=='exercise').length;return [records?records+'条知识记录':'',practiceCount?practiceCount+'道填空题':'',examCount?examCount+'道历年题目':''].filter(Boolean).join(' · ')||'没有匹配内容';}
function catalog(){
 const query=catalogQuery.trim();const selected=D.slides.filter(s=>isStudyItem(s)&&(filterModule==='all'||s.module===filterModule)&&matches(s,query));
 return titleBlock('COURSE INDEX','全量知识目录','按课程模块和知识主题组织。样板主题可以直接学习，其余内容可展开清单预览。')+`<input class="catalog-search" id="catalog-search" type="search" placeholder="搜索标题、知识点、表格内容或关键词" value="${esc(catalogQuery)}" aria-label="搜索知识目录"><div class="filter-row" aria-label="模块筛选"><button data-filter="all" class="${filterModule==='all'?'active':''}">全部模块</button>${D.modules.map(m=>`<button data-filter="${m.id}" class="${filterModule===m.id?'active':''}">${esc(m.title)}</button>`).join('')}</div><div class="catalog-stats"><span>${catalogCount(selected,query)}</span><span>231个内容主题</span><span>67个原生表格</span><span>164道填空题</span><span>清单预览保留原内容，尚待逐章编排</span></div><div id="catalog-list">${catalogList(selected,query)}</div>`;
}
function chapterSummaryHTML(s){
 const tables=s.tables.map(t=>{return t;});
 const notes=s.blocks.filter(b=>/^(本页归纳|专题提示)/.test(b.name)).map(b=>b.text.replaceAll('\n',''));
 if(s.page===223)notes.push('校园建筑、街区活力与综合参考答案可结合本章综合应用内容复习。');
 return `<article class="chapter-summary" id="catalog-${s.id}"><h3>${esc(s.title)}</h3>${tables.map(tableHTML).join('')}${notes.map(t=>`<p class="summary-note">${esc(t)}</p>`).join('')}${s.sources.length?`<p class="summary-source">${esc(s.sources.join('；'))}</p>`:''}</article>`;
}
function catalogList(selected,query){
 const examAvailable=(filterModule==='all'||filterModule==='exam')&&(D.examQuestions||[]).some(q=>examMatches(q,query));
 if(!selected.length&&!examAvailable)return empty('没有找到匹配内容，试试其他关键词。');
 return D.modules.map(m=>{
  const ss=selected.filter(s=>s.module===m.id);const hasExams=m.id==='exam'&&examAvailable;if(!ss.length&&!hasExams)return '';
  const summaries=ss.filter(s=>s.kind==='overview');
  const groups=m.groups.map(g=>{
   const gs=ss.filter(s=>s.page>=g.start&&s.page<=g.end&&s.kind!=='overview');if(!gs.length)return '';
   if(gs.every(s=>s.kind==='exercise')){const count=D.questions.filter(q=>q.module===m.id).length;return `<section class="module-practice-entry"><h3>${esc(m.title)}填空练习</h3><p>${count}道题目完整列出，可连续作答和核对答案。</p><a class="button secondary slim" href="#/practice/${m.id}">查看本模块全部${count}题 →</a></section>`;}

   return `<div class="catalog-group"><h3>${esc(g.title)}</h3>${gs.map(s=>{const k=lessonForPage(s.page);return `<details class="catalog-item" id="catalog-${s.id}" ${query&&ss.length<4?'open':''}><summary><span class="page-number">${s.page.toString().padStart(3,'0')}</span><span class="item-title">${esc(s.title)}</span><span class="status ${k||s.page===53?'sample':''}">${k||s.page===53?'样板可体验':'清单预览'}</span></summary><div class="catalog-content">${k?`<a class="button slim" href="#/lesson/${k}">进入学习主题 ↗</a>`:s.page===53?'<a class="button slim" href="#/practice">开始练习 ↗</a>':''}<p class="small-note">${esc(s.subtitle)} · 图片${s.images.length}处 · 表格${s.tables.length}个</p><ul>${s.body.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>${s.tables.map(tableHTML).join('')}${s.images.length?`<p class="small-note">图片已提取入库；全量图文排版将在后续迁移中完成。</p>`:''}<p class="small-note">${esc(s.sources.join('；'))}</p></div></details>`;}).join('')}</div>`;
  }).join('');
  return `<section class="catalog-module"><h2>${esc(m.title)} <small class="small-note">${hasExams?'历年题目与考点归纳':ss.filter(s=>s.kind!=='exercise').length+'条知识'}</small></h2>${hasExams?examQuestionsHTML(query):''}${summaries.length?`<section class="chapter-summaries" aria-label="${esc(m.title)}知识总表">${summaries.map(chapterSummaryHTML).join('')}</section>`:''}${groups}</section>`;
 }).join('');
}
function empty(t){return `<div class="empty-state"><h2>${esc(t)}</h2><p>可从知识目录或填空练习继续浏览。</p><a href="#/home" class="button secondary slim">返回首页</a></div>`;}
function practiceModules(){return D.modules.filter(m=>D.questions.some(q=>q.module===m.id));}
function practiceQuestions(){return D.questions.filter(q=>activePracticeModule==='all'||q.module===activePracticeModule);}
function practice(){
 const qs=practiceQuestions();const done=qs.filter(q=>state.answers[q.id]?.checked).length;const blanks=qs.reduce((n,q)=>n+q.blanks,0);const modules=practiceModules();const selected=modules.find(m=>m.id===activePracticeModule);const title=selected?selected.title+'填空练习':'全部填空练习';
 const scope=activePracticeModule==='all'?'全部模块':'本模块';
 const groups=modules.filter(m=>activePracticeModule==='all'||m.id===activePracticeModule).map(m=>{
  const questions=qs.filter(q=>q.module===m.id);const doneCount=questions.filter(q=>state.answers[q.id]?.checked).length;
  return `<section class="practice-module" id="practice-module-${m.id}" data-practice-module="${m.id}"><div class="practice-module-heading"><h2>${esc(m.title)}</h2><span>${questions.length}题 · 已提交${doneCount}题</span></div>${questions.map((q,i)=>questionHTML(q,i)).join('')}</section>`;
 }).join('');
 const references=[...new Set(qs.flatMap(q=>q.source||[]))];
 return titleBlock('RECALL & PRACTICE',title,`${qs.length}道题目，共${blanks}个空，全部在本页列出。`,`<button id="reset-practice" class="text-link">清空${scope}作答 ↺</button>`)+`<div class="practice-module-filters" aria-label="练习模块"><a href="#/practice" class="${activePracticeModule==='all'?'active':''}">全部模块 <span>${D.questions.length}题</span></a>${modules.map(m=>`<a href="#/practice/${m.id}" class="${activePracticeModule===m.id?'active':''}">${esc(m.title)} <span>${D.questions.filter(q=>q.module===m.id).length}题</span></a>`).join('')}</div><div class="key-note practice-heading">${scope}题目已全部展开，无需翻页或分批加载。先尝试回忆，再查看参考答案。<br><span class="small-note">练习来自课程归纳，与历年真题分开整理。按参考答案顺序核对，未预设的同义表达请自行对照。</span></div><div class="practice-toolbar"><span>已提交 <b id="practice-done">${done}</b> / <b id="practice-total">${qs.length}</b> 题</span><div class="progress-track"><span id="practice-progress" style="width:${qs.length?done/qs.length*100:0}%"></span></div><button class="text-link" id="reveal-all-answers">查看本页全部答案</button><a class="text-link" href="#/catalog${selected?'/'+selected.id:''}">查看相关知识 ↗</a></div><section id="questions">${groups}</section><details class="source-note practice-references"><summary>教材参考资料</summary>${references.map(r=>`<p>${esc(r)}</p>`).join('')}</details>`;
}
function questionHTML(q,i){const stored=state.answers[q.id];const values=stored?.values||[];let n=0;const stem=q.stem.replace(/^\d+[．.、]/,'').replace(/^[^：]+：/,'');const html=stem.split(/(_{4,})/).map(t=>/^_{4,}$/.test(t)?`<input class="blank-input ${stored?.checked?(stored.results[n]?'correct':'incorrect'):''}" aria-label="第${i+1}题第${n+1}空" data-question="${q.id}" data-blank="${n}" value="${esc(values[n++]||'')}" autocomplete="off">`:esc(t)).join('');return `<article class="question" id="${q.id}"><div class="question-heading"><span class="q-num">${String(i+1).padStart(2,'0')}</span><h2>${esc(q.title.replace(/^\d+[．.、]\s*/,''))}</h2></div><div class="question-stem">${html}</div><div class="question-actions"><button class="button secondary slim" data-check="${q.id}">核对答案</button><button class="text-link" data-reveal="${q.id}">查看参考答案</button></div><div class="feedback-container">${stored?.checked?feedback(q,stored):''}</div></article>`;}
function feedback(q,s){const correct=s.results.filter(Boolean).length;return `<div class="answer-feedback ${correct===q.blanks?'':'incorrect'}"><strong>${correct===q.blanks?'本题全部匹配':'本题 '+correct+' / '+q.blanks+' 个空匹配'}</strong>${q.answers.map((a,i)=>`<span class="answer-item">第${i+1}空：${esc(a)} ${s.results[i]?'✓':'· 请对照原答案'}</span>`).join('')}<span class="small-note">核对规则：忽略首尾空格、大小写与全半角字符差异，按原空格顺序匹配。</span></div>`;}
function review(){
 const wrong=D.questions.filter(q=>state.answers[q.id]?.checked&&!state.answers[q.id].results.every(Boolean));
 const renderList=(ids,label)=>ids.length?ids.map(k=>lessons[k]?`<div class="review-item"><div><h3><a href="#/lesson/${k}">${esc(lessons[k].title)} ↗</a></h3><small>${esc(lessons[k].module)}</small></div><button class="text-link" data-${label}="${k}">取消${label==='favorite'?'收藏':'掌握标记'}</button></div>`:'').join(''):'<p class="small-note">暂无记录，学习时可在主题页右侧标记。</p>';
 return titleBlock('MY STUDY NOTES','我的复习','收藏、掌握标记和练习记录保存在本机当前浏览器。')+`${memoryOnly?'<div class="sample-notice">浏览器存储当前不可用，记录仅在本次页面会话中保留，请导出备份。</div>':''}<section class="review-section"><h2>收藏的主题 <small class="small-note">${state.favorites.length}</small></h2>${renderList(state.favorites,'favorite')}</section><section class="review-section"><h2>已标记掌握 <small class="small-note">${state.mastered.length}</small></h2>${renderList(state.mastered,'mastered')}</section><section class="review-section"><h2>需要再练的题目 <small class="small-note">${wrong.length}</small></h2>${wrong.length?wrong.map(q=>`<div class="review-item"><div><h3>${esc(q.title)}</h3><small>${esc(q.moduleTitle)}</small></div><a class="text-link" href="#/practice/${q.module}?question=${q.id}">再练一次 →</a></div>`).join(''):'<p class="small-note">暂无错题记录。完成填空练习后，未匹配的题目会显示在这里。</p>'}</section><div class="review-tools"><button class="button secondary slim" id="export-progress">导出学习记录 ↓</button><button class="button secondary slim" id="import-progress">导入学习记录 ↑</button><input type="file" accept="application/json,.json" id="import-file" hidden></div><p class="small-note" style="margin-top:14px">更换浏览器或清除网站数据会影响本地记录；可以导出文件备份。记录仅用于个人复习。</p>`;
}

function render(){
 const raw=location.hash.slice(1)||'/home';const [path,query='']=raw.split('?');const parts=path.split('/').filter(Boolean);const route=parts[0]||'home';const params=new URLSearchParams(query);
 if(route!=='lesson'||parts[1]!==currentLesson)activeTab=0;
 if(route==='catalog'&&params.get('page')){const entry=page(Number(params.get('page')));if(entry?.kind==='exercise'){const question=D.questions.find(q=>q.page===entry.page);location.hash='#/practice/'+entry.module+(question?'?question='+question.id:'');return;}}
 if(route==='catalog'){filterModule=parts[1]&&D.modules.some(m=>m.id===parts[1])?parts[1]:'all';catalogQuery=params.get('q')||'';}
 if(params.has('year')&&(params.get('year')==='all'||D.examYears.map(String).includes(params.get('year'))))examYear=params.get('year');
 if(params.has('exam')){const q=(D.examQuestions||[]).find(q=>q.id===params.get('exam'));if(q)examYear=String(q.year);}
 if(route==='practice'){const valid=practiceModules().map(m=>m.id);activePracticeModule=valid.includes(parts[1])?parts[1]:'all';if(params.get('question')){const q=D.questions.find(q=>q.id===params.get('question'));if(q)activePracticeModule=q.module;}}
 const title=route==='lesson'?lessons[parts[1]]?.title:({home:'学习首页',catalog:'全量知识目录',practice:'随堂练习',review:'我的复习'}[route]);
 $('#breadcrumb').innerHTML=`秋季课程 <span>/</span> ${esc(title||'学习首页')}`;
 document.title=`${title||'学习首页'} · 圆点建筑工作室`;
 $('#main').innerHTML=route==='home'?home():route==='lesson'?lesson(parts[1]):route==='catalog'?catalog():route==='practice'?practice():route==='review'?review():empty('页面不存在。');
 document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===route));document.querySelectorAll('[data-lesson]').forEach(a=>a.classList.toggle('active',route==='lesson'&&a.dataset.lesson===parts[1]));
 $('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');
 if(params.get('page'))requestAnimationFrame(()=>{const el=$('#catalog-p'+params.get('page').padStart(3,'0'));if(el){el.open=true;el.scrollIntoView({block:'center'});}});
 if(params.get('question'))requestAnimationFrame(()=>$('#'+params.get('question'))?.scrollIntoView({block:'center'}));
 if(params.get('exam'))requestAnimationFrame(()=>document.getElementById(params.get('exam'))?.scrollIntoView({block:'center'}));
}
function normal(v){return String(v).normalize('NFKC').trim().replace(/\s+/g,'').toLowerCase();}
function updatePractice(){const qs=practiceQuestions();const done=qs.filter(q=>state.answers[q.id]?.checked).length;if($('#practice-done'))$('#practice-done').textContent=done;if($('#practice-progress'))$('#practice-progress').style.width=(qs.length?done/qs.length*100:0)+'%';document.querySelectorAll('[data-practice-module]').forEach(el=>{const list=D.questions.filter(q=>q.module===el.dataset.practiceModule);const count=list.filter(q=>state.answers[q.id]?.checked).length;el.querySelector('.practice-module-heading span').textContent=list.length+'题 · 已提交'+count+'题';});}
function toggle(field,key){if(!lessons[key])return;state[field]=state[field].includes(key)?state[field].filter(x=>x!==key):[...state[field],key];save();const position=window.scrollY;render();window.scrollTo(0,position);}
document.addEventListener('click',e=>{
 const target=e.target.closest('button,a,img');if(!target)return;
 if(target.dataset.tab!==undefined){activeTab=Number(target.dataset.tab);const pos=window.scrollY;render();window.scrollTo(0,pos);$('#tab-'+activeTab)?.focus({preventScroll:true});}
 if(target.dataset.favorite)toggle('favorites',target.dataset.favorite);
 if(target.dataset.mastered)toggle('mastered',target.dataset.mastered);
 if(target.dataset.filter){filterModule=target.dataset.filter;location.hash=filterModule==='all'?'#/catalog':'#/catalog/'+filterModule;}
 if(target.dataset.examYear)location.hash='#/catalog/exam?year='+target.dataset.examYear;
 if(target.dataset.zoom){$('#large-image').src=target.dataset.zoom;$('#large-image').alt=target.dataset.caption||'';$('#image-caption').textContent=target.dataset.caption||'';$('#image-dialog').showModal();}
 if(target.dataset.check){const q=D.questions.find(q=>q.id===target.dataset.check);const inputs=[...document.querySelectorAll(`input[data-question="${q.id}"]`)];const values=inputs.map(x=>x.value);if(values.some(v=>!v.trim())){toast('请先填写本题的全部空格。');inputs.find(x=>!x.value.trim())?.focus();return;}const results=values.map((v,i)=>normal(v)===normal(q.answers[i]));state.answers[q.id]={values,results,checked:true};save();inputs.forEach((x,i)=>{x.classList.toggle('correct',results[i]);x.classList.toggle('incorrect',!results[i]);});$('#'+q.id+' .feedback-container').innerHTML=feedback(q,state.answers[q.id]);updatePractice();}
 if(target.dataset.reveal){const q=D.questions.find(q=>q.id===target.dataset.reveal);const container=$('#'+q.id+' .feedback-container');container.innerHTML=`<div class="answer-feedback">参考答案（按空格顺序）：${q.answers.map(esc).join('；')}<br><span class="small-note">查看答案不计为已提交，请尝试填写并核对。</span></div>`;}
 if(target.id==='reset-practice'){const qs=practiceQuestions();for(const q of qs)delete state.answers[q.id];save();render();toast('已清空当前'+qs.length+'题的作答记录。');}
 if(target.id==='reveal-all-answers'){for(const q of practiceQuestions()){const el=document.getElementById(q.id);if(el)el.querySelector('.feedback-container').innerHTML=`<div class="answer-feedback">参考答案（按空格顺序）：${q.answers.map(esc).join('；')}<br><span class="small-note">查看答案不计为已提交。</span></div>`;}toast('本页全部参考答案已展开。');}
 if(target.id==='export-progress'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='建筑技术学习记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 if(target.id==='import-progress')$('#import-file').click();
 if(target.id==='menu-toggle'){const open=$('#sidebar').classList.toggle('open');target.setAttribute('aria-expanded',String(open));}
 if(target.id==='focus-toggle'){const on=document.body.classList.toggle('focus-mode');target.textContent=on?'退出专注':'专注阅读';}
 if(target.id==='search-toggle')openSearch();
 if(target.id==='search-close')$('#search-dialog').close();
 if(target.id==='image-close')$('#image-dialog').close();
});
document.addEventListener('input',e=>{
 if(e.target.id==='catalog-search'){catalogQuery=e.target.value;const selected=D.slides.filter(s=>isStudyItem(s)&&(filterModule==='all'||s.module===filterModule)&&matches(s,catalogQuery));$('#catalog-list').innerHTML=catalogList(selected,catalogQuery);$('.catalog-stats span').textContent=catalogCount(selected,catalogQuery);}
 if(e.target.id==='global-search')search(e.target.value);
 if(e.target.dataset.question){const id=e.target.dataset.question;const q=D.questions.find(q=>q.id===id);const values=[...document.querySelectorAll(`input[data-question="${id}"]`)].map(x=>x.value);state.answers[id]={values,checked:false,results:[]};save();document.querySelectorAll(`input[data-question="${id}"]`).forEach(x=>x.classList.remove('correct','incorrect'));$('#'+id+' .feedback-container').innerHTML='';updatePractice();}
});
function openSearch(){$('#search-dialog').showModal();$('#global-search').value='';search('');$('#global-search').focus();}
function search(query){const exams=query.trim()?(D.examQuestions||[]).filter(q=>examMatches(q,query)).slice(0,15):[];const results=query.trim()?D.slides.filter(s=>isStudyItem(s)&&matches(s,query)).slice(0,30-exams.length):[];$('#search-results').innerHTML=exams.length||results.length?exams.map(q=>`<a class="search-result" href="#/catalog/exam?exam=${q.id}" data-search-result><small>${q.year}年 · 真题题干 · ${esc(q.section)}第${esc(q.number)}题</small>${esc(q.title)}</a>`).join('')+results.map(s=>{const key=lessonForPage(s.page);const href=key?'#/lesson/'+key:s.kind==='exercise'?`#/practice/${s.module}`:`#/catalog/${s.module}?page=${s.page}`;return `<a class="search-result" href="${href}" data-search-result><small>${esc(s.moduleTitle)} · ${s.kind==='exercise'?'模块完整练习':key?'学习主题':'清单预览'}</small>${esc(s.title)}</a>`;}).join(''):`<p class="search-empty">${query.trim()?'未找到匹配内容。':'输入关键词，检索课程知识与历年题干。'}</p>`;}
document.addEventListener('click',e=>{if(e.target.closest('[data-search-result]'))$('#search-dialog').close();if(e.target.tagName==='DIALOG'&&e.offsetX>=0){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('img[data-zoom]')){e.preventDefault();e.target.click();}if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!$('dialog[open]')){e.preventDefault();openSearch();}if(e.key==='Escape'){document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');}if((e.key==='ArrowRight'||e.key==='ArrowLeft')&&e.target.matches('[role="tab"]')){const delta=e.key==='ArrowRight'?1:-1;activeTab=(activeTab+delta+lessons[currentLesson].tabs.length)%lessons[currentLesson].tabs.length;render();$('#tab-'+activeTab)?.focus();}});
document.addEventListener('change',async e=>{
 if(e.target.id!=='import-file'||!e.target.files[0])return;
 try{const v=JSON.parse(await e.target.files[0].text());const keys=Object.keys(lessons);if(v.version!==1||v.sourceSha256!==D.stats.sourceSha256||!Array.isArray(v.favorites)||!Array.isArray(v.mastered)||!v.answers||typeof v.answers!=='object')throw Error('文件格式或课程内容版本不匹配');const cleanAnswers={};for(const q of D.questions){const a=v.answers[q.id];if(!a||!Array.isArray(a.values)||a.values.length!==q.blanks)continue;const values=a.values.map(x=>String(x).slice(0,150));cleanAnswers[q.id]={values,checked:!!a.checked,results:a.checked?values.map((x,i)=>normal(x)===normal(q.answers[i])):[]};}state={...initial(),favorites:[...new Set(v.favorites.filter(k=>keys.includes(k)))],mastered:[...new Set(v.mastered.filter(k=>keys.includes(k)))],answers:cleanAnswers,lastLesson:keys.includes(v.lastLesson)?v.lastLesson:null};save();render();toast('学习记录已导入。');}catch(err){toast('无法导入：'+err.message);}
});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
render();
})();
