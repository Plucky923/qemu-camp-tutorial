# GitHub 报名

<div
  class="qemu-enrollment"
  data-enrollment
  data-api-base="https://api.qemu.gevico.online"
  data-local-api-base="http://localhost:8001"
>
  <div class="qemu-enrollment__content">
    <span class="qemu-enrollment__eyebrow">QEMU Training Camp 2026</span>
    <h2 class="qemu-enrollment__title">使用 GitHub 账号报名</h2>
    <p class="qemu-enrollment__description">报名确认后，系统将以你的 GitHub 身份记录实验进度，并为后续阶段仓库分配做好准备。</p>
  </div>
  <div class="qemu-enrollment__actions">
    <a class="qemu-enrollment__button" data-enrollment-action href="https://api.qemu.gevico.online/auth/github">使用 GitHub 报名</a>
    <span class="qemu-enrollment__status" data-enrollment-status aria-live="polite">正在检查报名状态...</span>
  </div>
  <form class="qemu-enrollment__lookup" data-enrollment-lookup>
    <label class="qemu-enrollment__lookup-label" for="qemu-enrollment-login">查询报名状态</label>
    <div class="qemu-enrollment__lookup-controls">
      <input
        class="qemu-enrollment__input"
        id="qemu-enrollment-login"
        name="github_login"
        type="text"
        maxlength="39"
        autocomplete="off"
        placeholder="GitHub 用户名"
        required
      />
      <button class="qemu-enrollment__lookup-button" type="submit">查询</button>
    </div>
    <span class="qemu-enrollment__lookup-result" data-enrollment-lookup-result aria-live="polite"></span>
  </form>
</div>

系统仅读取 GitHub 用户 ID、用户名、头像和经授权的邮箱，不会获取或保存 GitHub 密码。
