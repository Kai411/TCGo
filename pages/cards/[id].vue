<template>
  <!-- Wrapper element is required: the app-level page transition (out-in)
       needs an element root, and a bare <NuxtPage /> renders none — which
       left the next page blank after navigating away from a card. -->
  <div>
    <NuxtPage />
  </div>
</template>
