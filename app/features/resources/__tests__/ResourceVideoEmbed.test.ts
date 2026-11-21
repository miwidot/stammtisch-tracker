import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import ResourceVideoEmbed from '@/features/resources/ResourceVideoEmbed.vue';
describe('ResourceVideoEmbed', () => {
  it('loads the privacy-enhanced player only after consent', async () => {
    const wrapper = await mountSuspended(ResourceVideoEmbed, {
      props: { videoId: 'HGwD4drUq0I', title: 'TarkovMonitor walkthrough' },
      global: {
        stubs: {
          NuxtImg: { props: ['src', 'alt'], template: '<img :src="src" :alt="alt" />' },
          UIcon: true,
        },
      },
    });
    // No third-party request (thumbnail proxy included) before the visitor clicks play.
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.html()).not.toContain('ytimg.com');
    expect(wrapper.text()).toContain('TarkovMonitor walkthrough');
    expect(wrapper.find('iframe').exists()).toBe(false);
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('iframe').attributes('src')).toBe(
      'https://www.youtube-nocookie.com/embed/HGwD4drUq0I?autoplay=1&rel=0'
    );
  });
});
