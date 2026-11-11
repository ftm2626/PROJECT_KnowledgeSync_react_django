from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TopicViewSet, login, me, logout
router = DefaultRouter()
router.register('topics', TopicViewSet, basename='topic')
urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/', login),
    path('auth/me/', me),
    path('auth/logout/', logout),
]
