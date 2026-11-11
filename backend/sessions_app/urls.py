from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TopicViewSet, users, mock_login
router = DefaultRouter()
router.register('topics', TopicViewSet, basename='topic')
urlpatterns = [path('', include(router.urls)), path('auth/users/', users), path('auth/login/', mock_login)]
