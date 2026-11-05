// Avatares DiceBear servidos pelo próprio jogo (/avatar/<id>.svg)
window.Avatar = {
  url: (id) => `/avatar/${encodeURIComponent(id)}.svg`,
  img: (id, cls = '') => `<img class="avatar ${cls}" src="/avatar/${encodeURIComponent(id)}.svg" alt="" draggable="false">`,
};
