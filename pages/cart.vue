<template>
  <div class="py-16 text-center text-sm text-gray-500 dark:text-zinc-400">Opening checkout…</div>
</template>

<script setup lang="ts">
// The cart is the drawer; this page used to be the checkout. Old links to
// /cart still work: they check out everything in the cart.
const { items } = useCart();
const { startFromCart } = useCheckout();

onMounted(() => {
  startFromCart(items.value.map((i) => i.id));
  navigateTo("/checkout", { replace: true });
});
</script>
