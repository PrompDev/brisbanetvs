plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.brisbanetvs.calls"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.brisbanetvs.calls"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        buildConfigField("String", "API_BASE", "\"https://brisbanetvs.com\"")
    }

    val releaseStorePath = providers.environmentVariable("BRISBANE_CALLS_KEYSTORE").orNull
    val releaseStorePassword = providers.environmentVariable("BRISBANE_CALLS_STORE_PASSWORD").orNull
    val releaseKeyAlias = providers.environmentVariable("BRISBANE_CALLS_KEY_ALIAS").orNull
    val releaseKeyPassword = providers.environmentVariable("BRISBANE_CALLS_KEY_PASSWORD").orNull

    signingConfigs {
        if (!releaseStorePath.isNullOrBlank()
            && !releaseStorePassword.isNullOrBlank()
            && !releaseKeyAlias.isNullOrBlank()
            && !releaseKeyPassword.isNullOrBlank()
        ) {
            create("release") {
                storeFile = file(releaseStorePath)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
