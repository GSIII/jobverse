// static/js/formRenderer.js
import { formFields, documentForm } from "./domElements.js";
import {
  handleDocumentFormSubmit,
  handlePortfolioFormSubmit,
} from "./formSubmitHandler.js";

/* =========================
   공통: API 베이스/토큰 유틸
   ========================= */
const ROOT_PREFIX = window.location.pathname.startsWith("/text") ? "/text" : "";
const API_BASE =
  location.hostname === "localhost"
    ? "http://localhost:5000/api/profile/me" // 로컬 직통(마이페이지 서버)
    : `${ROOT_PREFIX}/apiText`;   

// 로컬/배포에 따라 "마이페이지 프로필" 엔드포인트만 분리
const IS_LOCAL =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  // Vite 프록시 등 개발용 도메인 대응 원하면 여기에 추가
  false;

const USER_PROFILE_URL = IS_LOCAL
  ? "http://localhost:5000/api/profile/me"
  : `${API_BASE}/user_profile`;

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}
function authHeaders(extra = {}) {
  const t = getToken();
  return t ? { ...extra, Authorization: `Bearer ${t}` } : { ...extra };
}

/* =========================
   공용 렌더 유틸
   ========================= */
function renderInput(field, namePrefix = "", value = "") {
  const requiredMark = field.required ? '<span class="required">*</span>' : "";
  const labelHTML = field.label
    ? `<label>${field.label}${requiredMark}</label>`
    : "";

  if (field.type === "select") {
    return `
      ${labelHTML}
      <select name="${namePrefix + field.name}" ${
        field.required ? "required" : ""
      }>
        ${field.options
          .map(
            (opt) =>
              `<option value="${opt}" ${value === opt ? "selected" : ""}>${
                opt || "선택"
              }</option>`
          )
          .join("")}
      </select>`;
  }

  if (field.type === "textarea") {
    return `
      ${labelHTML}
      <textarea name="${namePrefix + field.name}" ${
        field.required ? "required" : ""
      }>${value || ""}</textarea>`;
  }

  return `
    ${labelHTML}
    <input type="${field.type}" name="${namePrefix + field.name}" value="${
      value || ""
    }" ${field.required ? "required" : ""}>`;
}

/* =========================
   MyPage → 이력서 매핑 유틸
   ========================= */
function isEmptyResumeContent(content = {}) {
  const keys = ["education", "activities", "awards", "certificates"];
  return (
    !content ||
    keys.every((k) => {
      const v = content[k];
      if (Array.isArray(v)) {
        return (
          v.length === 0 ||
          v.every((x) => !x || JSON.stringify(x) === "{}" || x === "")
        );
      }
      return !v;
    })
  );
}

async function fetchUserProfileSafe() {
  try {
    // 디버깅: 실제 요청 URL, Host 표시
    console.log("🛰️ [프로필 요청] URL:", USER_PROFILE_URL, "Host:", location.host);

    const res = await fetch(USER_PROFILE_URL, {
      headers: authHeaders(),
      credentials: IS_LOCAL ? "include" : "same-origin",
    });

    // 응답 상태 로그
    console.log("🛰️ [프로필 응답] status:", res.status);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // ✅ 콘솔 디버깅: 마이페이지 응답 전체 확인
    console.log("📌 [마이페이지 API 응답]", data);

    return data;
  } catch (e) {
    console.warn("⚠️ 프로필 불러오기 실패(무시하고 빈값 사용):", e);
    return null;
  }
}

// currentContent가 비어있으면 마이페이지 프로필로 기본값 채워서 반환
async function hydrateResumeContentIfEmpty(currentContent = {}) {
  if (!isEmptyResumeContent(currentContent)) return currentContent;

  const profile = await fetchUserProfileSafe();
  if (!profile) return currentContent;

  const safeArray = (v, fallback) =>
    Array.isArray(v) && v.length ? v : fallback;

  return {
    education: safeArray(profile.education, [
      { level: "", status: "", school: "", major: "" },
    ]),
    activities: safeArray(profile.activities, [{ title: "", content: "" }]),
    awards: safeArray(profile.awards, [{ title: "", content: "" }]),
    certificates: safeArray(profile.certificates, [""]),
  };
}

/* =========================
   행 DOM 생성기
   ========================= */
// 학력
function eduRowHTML(idx, data = {}) {
  const namePrefix = `education_${idx}_`;
  return `
    <div class="item-entry resume-edu-item" data-index="${idx}">
      <div class="input-group">
        ${renderInput(
          {
            name: "level",
            label: "학력",
            type: "select",
            options: ["", "고등학교", "전문대학", "대학교(4년제)", "대학원"],
          },
          namePrefix,
          data.level || ""
        )}
      </div>
      <div class="input-group">
        ${renderInput(
          {
            name: "status",
            label: "졸업 상태",
            type: "select",
            options: ["", "졸업", "재학중", "휴학", "중퇴"],
          },
          namePrefix,
          data.status || ""
        )}
      </div>
      <div class="input-group">
        ${renderInput(
          { name: "school", label: "학교명", type: "text" },
          namePrefix,
          data.school || ""
        )}
      </div>
      <div class="input-group">
        ${renderInput(
          { name: "major", label: "전공", type: "text" },
          namePrefix,
          data.major || ""
        )}
      </div>

      <div class="item-actions" style="display:flex; gap:8px; justify-content:flex-end; margin-top:6px;">
        <button type="button" class="add-after-button">+ 추가</button>
        <button type="button" class="remove-item-button">삭제</button>
      </div>
    </div>
  `;
}

// 활동/수상 (2열)
function twoColRowHTML(sectionKey, idx, data = {}, labels = ["제목", "내용"]) {
  const namePrefix = `${sectionKey}_${idx}_`;
  return `
    <div class="item-entry" data-index="${idx}">
      <div class="input-group">
        ${renderInput(
          { name: "title", label: labels[0], type: "text" },
          namePrefix,
          data.title || ""
        )}
      </div>
      <div class="input-group">
        ${renderInput(
          { name: "content", label: labels[1], type: "text" },
          namePrefix,
          data.content || ""
        )}
      </div>

      <div class="item-actions" style="display:flex; gap:8px; justify-content:flex-end; margin-top:6px;">
        <button type="button" class="add-after-button">+ 추가</button>
        <button type="button" class="remove-item-button">삭제</button>
      </div>
    </div>
  `;
}

// 자격증(문자열)
function certRowHTML(idx, value = "") {
  return `
    <div class="item-entry" data-index="${idx}">
      <div class="input-group">
        ${renderInput(
          { name: "name", label: `자격증 ${idx + 1}`, type: "text" },
          `certificates_${idx}_`,
          value
        )}
      </div>

      <div class="item-actions" style="display:flex; gap:8px; justify-content:flex-end; margin-top:6px;">
        <button type="button" class="add-after-button">+ 추가</button>
        <button type="button" class="remove-item-button">삭제</button>
      </div>
    </div>
  `;
}

/* =========================
   이벤트 위임
   ========================= */
function wireInlineAddRemove(section, rowFactory) {
  const container = document.getElementById(`${section}-container`);
  if (!container) return;

  container.addEventListener("click", (e) => {
    const entry = e.target.closest(".item-entry");

    if (e.target.classList.contains("add-after-button")) {
      e.preventDefault();
      const nextIdx = container.querySelectorAll(".item-entry").length;
      const temp = document.createElement("div");
      temp.innerHTML = rowFactory(nextIdx, {});
      const node = temp.firstElementChild;
      container.insertBefore(node, entry ? entry.nextSibling : null);
      return;
    }

    if (e.target.classList.contains("remove-item-button")) {
      e.preventDefault();
      if (entry) entry.remove();
      const remain = container.querySelectorAll(".item-entry").length;
      if (remain === 0) {
        const temp = document.createElement("div");
        temp.innerHTML = rowFactory(0, {});
        container.appendChild(temp.firstElementChild);
      }
      return;
    }
  });
}

/* =========================
   메인 렌더
   ========================= */
export async function renderFormFields(schema, currentContent = {}) {
  formFields.innerHTML = "";
  const docKoreanName =
    schema.korean_name || schema.title || currentContent.koreanName;

  // 포트폴리오
  if (docKoreanName === "포트폴리오") {
    formFields.innerHTML = `
      <div class="input-group">
        <label>포트폴리오 PDF 업로드:</label>
        <input type="file" name="portfolio_pdf" accept=".pdf">
      </div>
      <div class="input-group">
        <label>포트폴리오 링크 입력:</label>
        <input type="text" name="portfolio_link" value="${
          currentContent.portfolio_link || ""
        }">
      </div>`;
    document.querySelector('#document-form button[type="submit"]').textContent =
      "요약 및 다운";
    documentForm.onsubmit = handlePortfolioFormSubmit;
    return;
  }

  // 자기소개서
  if (docKoreanName === "자기소개서") {
    const container = document.createElement("div");
    const COVER_LETTER_FIELDS = [
      {
        name: "reason_for_application",
        label: "1. 해당 직무에 지원한 이유",
        type: "textarea",
        required: true,
      },
      {
        name: "expertise_experience",
        label: "2. 전문성을 기르기 위한 경험",
        type: "textarea",
        required: true,
      },
      {
        name: "collaboration_experience",
        label: "3. 협업 경험",
        type: "textarea",
        required: true,
      },
      {
        name: "challenging_goal_experience",
        label: "4. 도전 목표 경험",
        type: "textarea",
        required: true,
      },
      { name: "growth_process", label: "5. 성장과정", type: "textarea", required: true },
    ];
    COVER_LETTER_FIELDS.forEach((f) => {
      container.innerHTML += `<div class="input-group">${renderInput(
        f,
        "",
        currentContent[f.name] || ""
      )}</div>`;
    });
    formFields.appendChild(container);
    documentForm.onsubmit = handleDocumentFormSubmit;
    return;
  }

  // 이력서 — 비어 있으면 마이페이지 프로필로 자동 프리필
  if (docKoreanName === "이력서") {
    const hydrated = await hydrateResumeContentIfEmpty(currentContent);

    const resumeContainer = document.createElement("div");
    resumeContainer.className = "resume-form";

    // 학력
    const edu =
      Array.isArray(hydrated.education) && hydrated.education.length
        ? hydrated.education
        : [{ level: "", status: "", school: "", major: "" }];

    resumeContainer.innerHTML += `
      <h3>학력사항</h3>
      <div id="education-container" class="array-field-container">
        ${edu.map((row, i) => eduRowHTML(i, row)).join("")}
      </div>
      <hr/>`;

    // 대외활동
    const acts =
      Array.isArray(hydrated.activities) && hydrated.activities.length
        ? hydrated.activities
        : [{ title: "", content: "" }];

    resumeContainer.innerHTML += `
      <h3>대외활동</h3>
      <div id="activities-container" class="array-field-container">
        ${acts
          .map((row, i) => twoColRowHTML("activities", i, row))
          .join("")}
      </div>
      <hr/>`;

    // 수상경력
    const awds =
      Array.isArray(hydrated.awards) && hydrated.awards.length
        ? hydrated.awards
        : [{ title: "", content: "" }];

    resumeContainer.innerHTML += `
      <h3>수상경력</h3>
      <div id="awards-container" class="array-field-container">
        ${awds.map((row, i) => twoColRowHTML("awards", i, row)).join("")}
      </div>
      <hr/>`;

    // 자격증
    const certs =
      Array.isArray(hydrated.certificates) && hydrated.certificates.length
        ? hydrated.certificates
        : [""];

    resumeContainer.innerHTML += `
      <h3>자격증</h3>
      <div id="certificates-container" class="array-field-container">
        ${certs.map((v, i) => certRowHTML(i, v)).join("")}
      </div>`;

    formFields.appendChild(resumeContainer);

    // 행 추가/삭제 위임
    wireInlineAddRemove("education", eduRowHTML);
    wireInlineAddRemove("activities", (idx, data) =>
      twoColRowHTML("activities", idx, data)
    );
    wireInlineAddRemove("awards", (idx, data) =>
      twoColRowHTML("awards", idx, data)
    );
    wireInlineAddRemove("certificates", certRowHTML);

    documentForm.onsubmit = handleDocumentFormSubmit;
    return;
  }
}
