import DefaultTheme from 'vitepress/theme';
import { nextTick, onMounted, watch } from 'vue';
import { useRoute } from 'vitepress';
import mediumZoom from 'medium-zoom';
import './custom.css';

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute();
    // medium-zoom 依赖 window，只能在客户端（onMounted）创建；
    // 常驻一个实例，路由切换后 detach 重挂，避免旧 DOM 上的监听堆积
    let zoom = null;
    const bind = () => {
      if (!zoom) zoom = mediumZoom({ background: 'rgba(17,17,20,0.86)' });
      zoom.detach();
      zoom.attach('.vp-doc img:not(a img)');
    };
    onMounted(bind);
    watch(() => route.path, () => nextTick(bind));
  },
};
